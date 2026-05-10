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

export default adminUsersRouter;
