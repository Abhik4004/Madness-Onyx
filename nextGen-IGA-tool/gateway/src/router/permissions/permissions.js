import { Router } from "express";
import { relayMiddleware } from "../../nats/relay.js";

const permissionsRouter = Router();

permissionsRouter.get("/", relayMiddleware);

export default permissionsRouter;
