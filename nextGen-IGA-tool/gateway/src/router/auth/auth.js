import { Router } from "express";
import { body, validationResult } from "express-validator";
import buildResponse from "../../utils/response-builder.js";
import { relayMiddleware } from "../../nats/relay.js";

const userRouter = Router();

const validateLogin = [
  body("uid")
    .notEmpty().withMessage("Username/UID required"),
  body("password")
    .notEmpty().withMessage("Password required"),
];


const validateRegister = [
  body("email").notEmpty().isEmail().normalizeEmail(),
  body("password")
    .notEmpty().trim()
    .isLength({ min: 8, max: 12 })
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/),
  body("username").notEmpty().trim().isLength({ min: 3, max: 30 }),
];

async function validateAndRelay(req, res) {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    return res.status(400).json(
      buildResponse({ status: 400, message: "Validation failed", data: result.array() }),
    );
  }
  
  const ACCESS_MGMT_URL = process.env.ACCESS_MGMT_URL || "http://access-management:3001";
  try {
    const response = await fetch(`${ACCESS_MGMT_URL}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    res.status(502).json({ ok: false, message: "Auth service unreachable" });
  }
}


// Public routes — JWT middleware skips these (see jwt.js PUBLIC_PATHS)
userRouter.post("/login",    validateLogin,    validateAndRelay);
userRouter.post("/loginPrimary", relayMiddleware);
userRouter.post("/register", validateRegister, validateAndRelay);

// Protected routes — JWT middleware runs before these
userRouter.post("/logout",  relayMiddleware);
userRouter.post("/refresh", relayMiddleware);
userRouter.post("/mfa/setup", relayMiddleware);
userRouter.post("/mfa/verify", relayMiddleware);

// User management
userRouter.get("/me",                    relayMiddleware);
userRouter.put("/password",              relayMiddleware);
userRouter.get("/",                      relayMiddleware);
userRouter.get("/:id",                   relayMiddleware);
userRouter.put("/:id/role",              relayMiddleware);
userRouter.put("/:id/deactivate",        relayMiddleware);
userRouter.get("/:id/access", async (req, res) => {
  try {
    const ACCESS_MGMT_URL = process.env.ACCESS_MGMT_URL || "http://access-management:3001";
    const { id } = req.params;
    const response = await fetch(`${ACCESS_MGMT_URL}/api/user/${id}/access`);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error("[gateway] user access fetch error:", err.message);
    res.status(502).json({ ok: false, message: "Access management service unreachable" });
  }
});

export default userRouter;
