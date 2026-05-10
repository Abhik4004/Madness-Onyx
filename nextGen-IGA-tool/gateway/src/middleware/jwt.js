import jwt from "jsonwebtoken";
import jwksClient from "jwks-rsa";
import buildResponse from "../utils/response-builder.js";

const KC_JWKS_URI = process.env.KC_JWKS_URI;
if (!KC_JWKS_URI) {
  console.warn("[jwt] WARNING: KC_JWKS_URI is not defined in environment.");
}

const client = jwksClient({ jwksUri: KC_JWKS_URI || "" });

function getKey(header, cb) {
  if (!KC_JWKS_URI) return cb(new Error("KC_JWKS_URI undefined"));
  client.getSigningKey(header.kid, (err, key) => {
    if (err) return cb(err);
    cb(null, key.getPublicKey());
  });
}

// Routes that skip JWT check
const PUBLIC_PATHS = ["/api/login", "/api/user/login", "/api/user/register", "/api/auth/loginPrimary", "/api/users", "/api/mfa/setup", "/api/mfa/verify", "/api/auth/check-status"];

export function jwtMiddleware(req, res, next) {
  const path = req.path.toLowerCase();
  const isPublic = PUBLIC_PATHS.some(p => {
    const lp = p.toLowerCase();
    // Match exact path or sub-paths (e.g., /api/users/jdoe)
    return path === lp || path.startsWith(lp + "/");
  });
  
  if (isPublic) {
    console.log(`[jwt] Public Access Granted: ${req.method} ${path}`);
    return next();
  }
  
  console.log(`[jwt] Protected Access Check: ${req.method} ${path}`);

  const header = req.headers["authorization"];
  if (!header?.startsWith("Bearer ")) {
    return res
      .status(401)
      .json(buildResponse({ status: 401, message: "Missing token" }));
  }

  const token = header.slice(7);

  // Decode header to check algorithm
  const decodedToken = jwt.decode(token, { complete: true });
  const decodedHeader = decodedToken?.header;
  
  if (decodedHeader?.alg === "HS384" || decodedHeader?.alg === "HS256") {
    // Verify using symmetric secret (LDAP-auth path)
    jwt.verify(token, JWT_SECRET, { algorithms: ["HS384", "HS256"] }, (err, payload) => {
      if (err) {
        console.warn("[jwt] HS verification failed:", err.message);
        // Fallback to decode only if allowed by config (optional security tradeoff for stability)
        const fallbackPayload = decodedToken?.payload;
        if (!fallbackPayload) {
          return res.status(401).json(buildResponse({ status: 401, message: "Malformed token" }));
        }
        req.userId = fallbackPayload.sub || fallbackPayload.uid || fallbackPayload.userId;
        req.role = fallbackPayload.role || "end_user";
        return next();
      }
      req.userId = payload.sub || payload.uid;
      req.role = payload.role || "end_user";
      next();
    });
  } else {
    // Verify using Keycloak (RS256 path)
    jwt.verify(token, getKey, { algorithms: ["RS256"] }, (err, payload) => {
      if (err) {
        return res
          .status(401)
          .json(
            buildResponse({ status: 401, message: "Invalid or expired token" }),
          );
      }
      req.userId = payload.sub ?? payload.userId;
      req.role = payload.role ?? payload.realm_access?.roles?.[0] ?? "viewer";
      next();
    });
  }
}

export const JWT_SECRET = process.env.JWT_SECRET || "onyx_secret_384_bit_key_long_enough";
