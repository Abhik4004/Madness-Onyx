import { Router } from "express";
import { relayMiddleware } from "../../nats/relay.js";

const rolesRouter = Router();

rolesRouter.get("/",       relayMiddleware);
rolesRouter.get("/:id",    relayMiddleware);
rolesRouter.post("/",      relayMiddleware);
rolesRouter.put("/:id",    relayMiddleware);

export default rolesRouter;
