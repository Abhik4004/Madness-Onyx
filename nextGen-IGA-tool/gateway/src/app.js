import express from "express";
import cors from "cors";
import "dotenv/config";
import { connect } from "nats";
import { relayMiddleware } from "./nats/relay.js";
import { jwtMiddleware } from "./middleware/jwt.js";
import { db } from "./db.js";

// Import routers
import authRouter from "./router/auth/auth.js";
import adminUsersRouter from "./router/admin/users.js";
import accessRouter from "./router/access/access.js";
import recRouter from "./router/recommendation/recommendation.js";
import auditRouter from "./router/audit/audit.js";
import rolesRouter from "./router/roles/roles.js";
import permissionsRouter from "./router/permissions/permissions.js";
import applicationsRouter from "./router/applications/applications.js";
import dataRouter from "./router/provision/prov.js";
import notificationsRouter from "./router/notifications/notifications.js";

const app = express();
const PORT = process.env.PORT || 3000;
const ACCESS_MGMT_URL = process.env.ACCESS_MGMT_URL || "http://127.0.0.1:3001";

const getIdentityHeaders = (req) => ({
  "Content-Type": "application/json",
  "X-User-Id": req.userId || "anonymous",
  "X-User-Role": req.role || "user"
});

app.use(cors());
app.use(express.json());

// ── Public Routes ────────────────────────────────────────────────────────────
app.use("/api/auth", authRouter);

// ── Public: Login ─────────────────────────────────────────────────────────────
app.post("/api/login", async (req, res) => {
  try {
    const { uid, password } = req.body;
    if (!uid || !password) {
      return res.status(400).json({ ok: false, message: "uid and password are required" });
    }

    const upstream = await fetch(`${process.env.EXTERNAL_AUTH_URL || "http://18.60.129.12:8080"}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uid, password }),
      signal: AbortSignal.timeout(15000)
    });

    const data = await upstream.json().catch(() => ({}));
    res.status(upstream.status).json(data);
  } catch (err) {
    console.error("[gateway] LOGIN error:", err.message);
    res.status(502).json({ ok: false, message: "Login service unreachable" });
  }
});

// ── Public: User Registration ─────────────────────────────────────────────────
const PROVISION_URL = process.env.EXTERNAL_AUTH_URL
  ? `${process.env.EXTERNAL_AUTH_URL}/api/provision/users`
  : "http://18.60.129.12:8080/api/provision/users";

app.post("/api/user/register", async (req, res) => {
  try {
    const { userId, email, password, full_name, givenName, sn, role } = req.body;

    if (!userId || !email || !password) {
      return res.status(400).json({ ok: false, message: "userId, email and password are required" });
    }

    const uid = userId.trim().toLowerCase();
    const nameParts = (full_name || "").split(" ");

    const payload = {
      users: [{
        uid,
        givenName: givenName || nameParts[0] || uid,
        sn: sn || nameParts.slice(1).join(" ") || "User",
        cn: full_name || uid,
        mail: email,
        password,
        additionalAttributes: { role: role || "end_user" }
      }]
    };

    console.log(`[gateway] REGISTER: Forwarding to ${PROVISION_URL}`, { uid });

    const upstream = await fetch(PROVISION_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000)
    });

    const data = await upstream.json().catch(() => ({}));

    if (!upstream.ok) {
      console.error("[gateway] REGISTER: upstream error", upstream.status, data);
      return res.status(upstream.status).json({ ok: false, message: data.message || "Registration failed" });
    }

    // ── Sync to local DB so user appears in users list immediately ──────────
    try {
      await db.query(
        `INSERT INTO users_access (id, employee_id, full_name, email, role_id, status, last_synced)
         VALUES (?, ?, ?, ?, ?, 'PENDING_APPROVAL', NOW())
         ON DUPLICATE KEY UPDATE
           full_name = VALUES(full_name),
           email = VALUES(email),
           role_id = VALUES(role_id),
           last_synced = NOW()`,
        [uid, uid, full_name || uid, email, role || "end_user"]
      );
      console.log(`[gateway] REGISTER: user ${uid} synced to local DB`);
    } catch (dbErr) {
      console.warn("[gateway] REGISTER: DB sync failed (user still provisioned):", dbErr.message);
    }

    res.status(201).json({ ok: true, message: "Account created successfully", data });
  } catch (err) {
    console.error("[gateway] REGISTER error:", err.message);
    res.status(502).json({ ok: false, message: "Registration service unreachable" });
  }
});

// ── Public: User Details ───────────────────────────────────────────────────────
app.post("/api/user/details", async (req, res) => {
  try {
    const { uid } = req.body;
    if (!uid) return res.status(400).json({ ok: false, message: "uid is required" });

    const upstream = await fetch(`${process.env.EXTERNAL_AUTH_URL || "http://18.60.129.12:8080"}/api/user/details`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uid }),
      signal: AbortSignal.timeout(15000)
    });

    const data = await upstream.json().catch(() => ({}));
    res.status(upstream.status).json(data);
  } catch (err) {
    console.error("[gateway] USER DETAILS error:", err.message);
    res.status(502).json({ ok: false, message: "Auth service unreachable" });
  }
});

// ── Create Group ──────────────────────────────────────────────────────────────
app.post("/api/create/group", async (req, res) => {
  try {
    const { groupCn, owner } = req.body;
    if (!groupCn || !owner) {
      return res.status(400).json({ ok: false, message: "groupCn and owner are required" });
    }

    const upstream = await fetch(`${process.env.EXTERNAL_AUTH_URL || "http://18.60.129.12:8080"}/api/create/group`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groupCn, owner }),
      signal: AbortSignal.timeout(15000)
    });

    const data = await upstream.json().catch(() => ({}));
    
    if (upstream.ok) {
      console.log(`[gateway] CREATE GROUP: Syncing ${groupCn} to local DB...`);
      try {
        await db.query(
          `INSERT INTO applications (id, app_name, app_type, risk_level, owner_id)
           VALUES (?, ?, 'infrastructure', 'MEDIUM', ?)
           ON DUPLICATE KEY UPDATE app_name = VALUES(app_name), owner_id = VALUES(owner_id)`,
          [groupCn, groupCn, owner]
        );
        console.log(`[gateway] CREATE GROUP: ${groupCn} synced successfully`);
      } catch (dbErr) {
        console.warn("[gateway] CREATE GROUP: DB sync failed:", dbErr.message);
      }
    }

    res.status(upstream.status).json(data);
  } catch (err) {
    console.error("[gateway] CREATE GROUP error:", err.message);
    res.status(502).json({ ok: false, message: "Auth service unreachable" });
  }
});

// ── JWT Protected Routes ─────────────────────────────────────────────────────
app.use(jwtMiddleware);

// ── DIRECT HTTP BYPASSES (Kill the LDAP_STREAM Ghosts) ───────────────────────
app.get("/api/users", async (req, res) => {
  try {
    console.log(`[gateway] BYPASS: Direct fetch from ${ACCESS_MGMT_URL}/api/users/list`);
    const response = await fetch(`${ACCESS_MGMT_URL}/api/users/list`, {
      headers: getIdentityHeaders(req)
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    console.error("[gateway] Bypass error:", err.message);
    res.status(502).json({ ok: false, message: `Access management service unreachable: ${err.message}` });
  }
});

app.post("/api/users/approve", async (req, res) => {
  try {
    console.log(`[gateway] BYPASS: Direct User Approve to ${ACCESS_MGMT_URL}/api/users/approve`);
    const response = await fetch(`${ACCESS_MGMT_URL}/api/users/approve`, {
      method: "POST",
      headers: getIdentityHeaders(req),
      body: JSON.stringify(req.body)
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    console.error("[gateway] User Approve Bypass Error:", err.message);
    res.status(502).json({ ok: false, message: "Access management service unreachable" });
  }
});

app.post("/api/users/group", async (req, res) => {
  try {
    console.log(`[gateway] BYPASS: Direct Group Add to ${ACCESS_MGMT_URL}/api/users/group/add`);
    const response = await fetch(`${ACCESS_MGMT_URL}/api/users/group/add`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body)
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    console.error("[gateway] Bypass error:", err.message);
    res.status(502).json({ ok: false, message: `Access management service unreachable: ${err.message}` });
  }
});

app.post("/api/users/update", async (req, res) => {
  try {
    console.log(`[gateway] BYPASS: Direct User Update to ${ACCESS_MGMT_URL}/api/users/update`);
    const response = await fetch(`${ACCESS_MGMT_URL}/api/users/update`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body)
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    console.error("[gateway] Bypass error:", err.message);
    res.status(502).json({ ok: false, message: `Access management service unreachable: ${err.message}` });
  }
});

app.post("/api/access/cert/campaign", async (req, res) => {
  try {
    const response = await fetch(`${ACCESS_MGMT_URL}/api/access/cert/campaign`, {
      method: "POST",
      headers: getIdentityHeaders(req),
      body: JSON.stringify(req.body)
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    console.error("[gateway] Request create bypass error:", err.message);
    res.status(502).json({ ok: false, message: `Access management service unreachable: ${err.message}` });
  }
});

app.get("/api/access/cert/campaign", async (req, res) => {
  try {
    const response = await fetch(`${ACCESS_MGMT_URL}/api/access/cert/campaign/list`, {
      headers: getIdentityHeaders(req)
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    console.error("[gateway] Request create bypass error:", err.message);
    res.status(502).json({ ok: false, message: `Access management service unreachable: ${err.message}` });
  }
});

app.get("/api/access/cert/campaign/:id", async (req, res) => {
  try {
    const response = await fetch(`${ACCESS_MGMT_URL}/api/access/cert/campaign/${req.params.id}`, {
      headers: getIdentityHeaders(req)
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    console.error("[gateway] Request create bypass error:", err.message);
    res.status(502).json({ ok: false, message: `Access management service unreachable: ${err.message}` });
  }
});

app.get("/api/access/cert/campaign/:id/items", async (req, res) => {
  try {
    const qs = new URLSearchParams(req.query).toString();
    const response = await fetch(`${ACCESS_MGMT_URL}/api/access/cert/campaign/${req.params.id}/items/list?${qs}`, {
      headers: getIdentityHeaders(req)
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    console.error("[gateway] Request create bypass error:", err.message);
    res.status(502).json({ ok: false, message: `Access management service unreachable: ${err.message}` });
  }
});

app.get("/api/access/cert/items", async (req, res) => {
  try {
    const qs = new URLSearchParams(req.query).toString();
    const response = await fetch(`${ACCESS_MGMT_URL}/api/access/cert/items/list?${qs}`, {
      headers: getIdentityHeaders(req)
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    console.error("[gateway] Request create bypass error:", err.message);
    res.status(502).json({ ok: false, message: `Access management service unreachable: ${err.message}` });
  }
});

app.put("/api/access/cert/decision", async (req, res) => {
  try {
    const response = await fetch(`${ACCESS_MGMT_URL}/api/access/cert/item/update`, {
      method: "POST",
      headers: getIdentityHeaders(req),
      body: JSON.stringify(req.body)
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    console.error("[gateway] Request create bypass error:", err.message);
    res.status(502).json({ ok: false, message: `Access management service unreachable: ${err.message}` });
  }
});

app.get("/api/access/cert/history", async (req, res) => {
  try {
    const response = await fetch(`${ACCESS_MGMT_URL}/api/access/cert/history/list`, {
      headers: getIdentityHeaders(req)
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    console.error("[gateway] Request create bypass error:", err.message);
    res.status(502).json({ ok: false, message: `Access management service unreachable: ${err.message}` });
  }
});

app.get("/api/access/cert/campaign/:id/report", async (req, res) => {
  try {
    const response = await fetch(`${ACCESS_MGMT_URL}/api/access/cert/campaign/${req.params.id}/report`, {
      headers: getIdentityHeaders(req)
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    console.error("[gateway] Request create bypass error:", err.message);
    res.status(502).json({ ok: false, message: `Access management service unreachable: ${err.message}` });
  }
});

app.post("/api/access/cert/item/update", async (req, res) => {
  try {
    const response = await fetch(`${ACCESS_MGMT_URL}/api/access/cert/item/update`, {
      method: "POST",
      headers: getIdentityHeaders(req),
      body: JSON.stringify(req.body)
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    console.error("[gateway] Request create bypass error:", err.message);
    res.status(502).json({ ok: false, message: `Access management service unreachable: ${err.message}` });
  }
});

app.get("/api/recommendation/audit", async (req, res) => {
  try {
    const response = await fetch(`http://127.0.0.1:3002/api/recommendation/audit`, {
      headers: getIdentityHeaders(req)
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    res.status(502).json({ ok: false, message: "Recommendation service unreachable" });
  }
});

app.get("/api/access/request", async (req, res) => {
  try {
    const qs = new URLSearchParams(req.query).toString();
    const targetUrl = `${ACCESS_MGMT_URL}/api/access/request/list${qs ? "?" + qs : ""}`;
    console.log(`[gateway] BYPASS: Direct Access Request List -> ${targetUrl}`);
    const response = await fetch(targetUrl, {
      headers: getIdentityHeaders(req)
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    console.error("[gateway] Bypass error:", err.message);
    res.status(502).json({ ok: false, message: `Access management service unreachable: ${err.message}` });
  }
});

app.post("/api/access/request", async (req, res) => {
  try {
    console.log(`[gateway] BYPASS: Direct Access Request Creation`);
    const response = await fetch(`${ACCESS_MGMT_URL}/api/access/request/create`, {
      method: "POST",
      headers: getIdentityHeaders(req),
      body: JSON.stringify(req.body)
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    console.error("[gateway] Request create bypass error:", err.message);
    res.status(502).json({ ok: false, message: `Access management service unreachable: ${err.message}` });
  }
});

app.put("/api/access/request/:id", async (req, res) => {
  try {
    console.log(`[gateway] BYPASS: Direct Access Request Update -> ${req.params.id}`);
    const response = await fetch(`${ACCESS_MGMT_URL}/api/access/request/${req.params.id}`, {
      method: "PUT",
      headers: getIdentityHeaders(req),
      body: JSON.stringify(req.body)
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    console.error("[gateway] Request update bypass error:", err.message);
    res.status(502).json({ ok: false, message: `Access management service unreachable: ${err.message}` });
  }
});

app.get("/api/admin/dashboard", async (req, res) => {

  try {
    console.log(`[gateway] BYPASS: Direct Dashboard Stats`);
    const response = await fetch(`${ACCESS_MGMT_URL}/api/dashboard/stats`, {
      headers: getIdentityHeaders(req)
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    console.error("[gateway] Bypass error:", err.message);
    res.status(502).json({ ok: false, message: `Access management service unreachable: ${err.message}` });
  }
});

app.get("/api/applications", async (req, res) => {
  try {
    console.log(`[gateway] BYPASS: Direct Applications List`);
    const response = await fetch(`${ACCESS_MGMT_URL}/api/applications/list`, {
      headers: getIdentityHeaders(req)
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    console.error("[gateway] Bypass error:", err.message);
    res.status(502).json({ ok: false, message: `Access management service unreachable: ${err.message}` });
  }
});

app.get("/api/roles", async (req, res) => {
  try {
    console.log(`[gateway] BYPASS: Direct Roles List`);
    const response = await fetch(`${ACCESS_MGMT_URL}/api/roles/list`, {
      headers: getIdentityHeaders(req)
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    console.error("[gateway] Bypass error:", err.message);
    res.status(502).json({ ok: false, message: `Access management service unreachable: ${err.message}` });
  }
});

app.get("/api/permissions", async (req, res) => {
  try {
    console.log(`[gateway] BYPASS: Direct Permissions List`);
    const response = await fetch(`${ACCESS_MGMT_URL}/api/permissions/list`, {
      headers: getIdentityHeaders(req)
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    console.error("[gateway] Bypass error:", err.message);
    res.status(502).json({ ok: false, message: `Access management service unreachable: ${err.message}` });
  }
});

app.get("/api/audit/log", async (req, res) => {
  try {
    const qs = new URLSearchParams(req.query).toString();
    const targetUrl = `${ACCESS_MGMT_URL}/api/audit/logs${qs ? "?" + qs : ""}`;
    console.log(`[gateway] BYPASS: Direct Audit Logs -> ${targetUrl}`);
    const response = await fetch(targetUrl, {
      headers: getIdentityHeaders(req)
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    console.error("[gateway] Bypass error:", err.message);
    res.status(502).json({ ok: false, message: `Access management service unreachable: ${err.message}` });
  }
});

app.get("/api/access/active", async (req, res) => {
  try {
    console.log(`[gateway] BYPASS: Direct Active Access List`);
    const response = await fetch(`${ACCESS_MGMT_URL}/api/access/active`, {
      headers: getIdentityHeaders(req)
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    console.error("[gateway] Bypass error:", err.message);
    res.status(502).json({ ok: false, message: `Access management service unreachable: ${err.message}` });
  }
});

app.get("/api/access/time", async (req, res) => {
  try {
    console.log(`[gateway] BYPASS: Direct Time Access List`);
    const response = await fetch(`${ACCESS_MGMT_URL}/api/access/time`, {
      headers: getIdentityHeaders(req)
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    console.error("[gateway] Bypass error:", err.message);
    res.status(502).json({ ok: false, message: `Access management service unreachable: ${err.message}` });
  }
});

app.get("/api/notifications", async (req, res) => {
  try {
    const qs = new URLSearchParams(req.query).toString();
    const targetUrl = `${ACCESS_MGMT_URL}/api/notifications/list${qs ? "?" + qs : ""}`;
    console.log(`[gateway] BYPASS: Direct Notifications -> ${targetUrl}`);
    const response = await fetch(targetUrl, {
      headers: getIdentityHeaders(req)
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    console.error("[gateway] Bypass error:", err.message);
    res.status(502).json({ ok: false, message: `Access management service unreachable: ${err.message}` });
  }
});

app.get("/api/recommendation/onboarding/:uid", async (req, res) => {
  try {
    const { uid } = req.params;
    const targetUrl = `http://localhost:3002/api/access-requests/onboarding/${uid}`;
    console.log(`[gateway] BYPASS: Rec Onboarding -> ${targetUrl}`);
    const response = await fetch(targetUrl, {
      headers: getIdentityHeaders(req)
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    res.status(502).json({ ok: false, message: "Recommendation service unreachable" });
  }
});

app.get("/api/recommendation/team/:uid", async (req, res) => {
  try {
    const { uid } = req.params;
    const targetUrl = `http://localhost:3002/api/access-requests/team/${uid}`;
    console.log(`[gateway] BYPASS: Rec Team -> ${targetUrl}`);
    const response = await fetch(targetUrl, {
      headers: getIdentityHeaders(req)
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    res.status(502).json({ ok: false, message: "Recommendation service unreachable" });
  }
});

// ── AI / ANALYTICS BYPASS ────────────────────────────────────────────────────
const AI_BASE_URL = "http://13.234.90.97";

app.use("/api/v1", async (req, res) => {
  try {
    const url = `${AI_BASE_URL}/api/v1${req.path}`;
    const options = {
      method: req.method,
      headers: {
        ...getIdentityHeaders(req),
        "Content-Type": "application/json"
      }
    };
    
    if (req.method !== "GET" && req.method !== "HEAD") {
      options.body = JSON.stringify(req.body);
    }
    
    const qs = new URLSearchParams(req.query).toString();
    const finalUrl = qs ? `${url}?${qs}` : url;

    console.log(`[gateway] BYPASS: Direct AI Service -> ${finalUrl}`);

    const response = await fetch(finalUrl, {
      ...options,
      signal: AbortSignal.timeout(15000)
    });
    const data = await response.json().catch(() => ({}));
    
    if (!response.ok) {
      return res.status(response.status).json(data);
    }
    
    res.status(response.status).json(data);
  } catch (err) {
    console.error("[gateway] AI bypass error:", err.message);
    res.status(502).json({ ok: false, message: "External AI service unreachable" });
  }
});

// ── Regular Routers ──────────────────────────────────────────────────────────
app.use("/api/provision", dataRouter);
app.post(
  "/api/access/time",
  (req, res, next) => {
    if (!req.body.uid || req.body.uid === "current_user") {
      req.body.uid = req.userId || "anonymous";
    }
    next();
  },
  relayMiddleware,
);

app.get("/api/access/cert/items", relayMiddleware);
app.use("/api/access", accessRouter);
app.use("/api/recommendation", recRouter);
app.use("/api/audit", auditRouter);
app.use("/api/roles", rolesRouter);
app.use("/api/permissions", permissionsRouter);
app.use("/api/applications", applicationsRouter);

// Fallback for other /api/users endpoints
app.use("/api/users", adminUsersRouter);

app.use("/api/user/details", relayMiddleware);
app.use("/api/user", adminUsersRouter); // Alias

// ── Error Handling ───────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error("[gateway] Error:", err.message);
  res.status(500).json({ ok: false, message: "Internal Gateway Error" });
});

async function main() {
  const NATS_URL = process.env.NATS_URL || "nats://54.224.250.252:4222";
  try {
    const nc = await connect({ servers: NATS_URL });
    console.log("[gateway] connected to NATS:", nc.getServer());

    app.listen(PORT, () => {
      console.log(`[gateway] listening on port ${PORT}`);
    });
  } catch (err) {
    console.error("[gateway] fatal:", err.message);
    process.exit(1);
  }
}

main();
