import { Router } from "express";
import { relayMiddleware } from "../../nats/relay.js";

const accessRouter = Router();

accessRouter.use((req, res, next) => {
  console.log(`[accessRouter] ${req.method} ${req.path}`);
  next();
});

// Access Request
accessRouter.get("/request",            relayMiddleware);   // list (sync)
accessRouter.post("/request",           relayMiddleware);   // create (async 202)
accessRouter.get("/request/:requestId", relayMiddleware);   // get by id (sync)
accessRouter.put("/request/:requestId", relayMiddleware);   // approve/reject/cancel (async 202)

// Time-based Access
accessRouter.get("/time",              relayMiddleware);    // list (sync)
accessRouter.get("/time/:id",          relayMiddleware);    // get by id (sync)
accessRouter.post("/time",             relayMiddleware);    // create (async 202)
accessRouter.delete("/time/:id",       relayMiddleware);    // revoke (async 202)

// Certification
accessRouter.get("/cert/items",              relayMiddleware);
accessRouter.post("/cert/campaign",    relayMiddleware);
accessRouter.get("/cert/campaign",     relayMiddleware);
accessRouter.get("/cert/campaign/:id",       relayMiddleware);
accessRouter.get("/cert/campaign/:id/items", relayMiddleware);
accessRouter.get("/cert/history",           relayMiddleware);
accessRouter.put("/cert/decision",          relayMiddleware);

// General Active Access
accessRouter.get("/active",            relayMiddleware);

// Managed Applications & LDAP Sync
accessRouter.post("/managed-apps",      relayMiddleware);
accessRouter.post("/managed-apps/sync", relayMiddleware);
accessRouter.delete("/managed-apps/sync", relayMiddleware);

export default accessRouter;
