import { Router } from "express";
import { relayMiddleware } from "../../nats/relay.js";

const applicationsRouter = Router();

applicationsRouter.get("/",               relayMiddleware);   // list (sync) — ?search=&category=
applicationsRouter.get("/:id",            relayMiddleware);   // get by id (sync)
applicationsRouter.get("/:id/roles",      relayMiddleware);   // list roles for app (sync)
applicationsRouter.post("/",              relayMiddleware);   // create (async 202)

export default applicationsRouter;
