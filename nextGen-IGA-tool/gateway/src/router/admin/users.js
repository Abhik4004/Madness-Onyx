import { Router } from "express";
import { relayMiddleware } from "../../nats/relay.js";

const adminUsersRouter = Router();

// ── NATS JetStream Relay Routes ──────────────────────────────────────────
// These routes are fully decoupled. The API Gateway forwards the request 
// parameters to the NATS broker, and the user management service consumes them.
// ─────────────────────────────────────────────────────────────────────────

adminUsersRouter.get("/", relayMiddleware);
adminUsersRouter.post("/details", relayMiddleware);
adminUsersRouter.post("/update", relayMiddleware);

adminUsersRouter.get("/:uid/groups", relayMiddleware);
adminUsersRouter.post("/:uid/group", relayMiddleware);
adminUsersRouter.delete("/:uid/group", relayMiddleware);

adminUsersRouter.get("/:id/access", async (req, res) => {
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

export default adminUsersRouter;
