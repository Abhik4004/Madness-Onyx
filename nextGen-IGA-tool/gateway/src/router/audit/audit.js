import { Router } from "express";
import { relayMiddleware } from "../../nats/relay.js";

const auditRouter = Router();

auditRouter.post("/report", relayMiddleware);
auditRouter.get("/log",     relayMiddleware);

export default auditRouter;
