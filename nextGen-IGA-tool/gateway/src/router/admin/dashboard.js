import { Router } from "express";
import { relayMiddleware } from "../../nats/relay.js";

const dashboardRouter = Router();

dashboardRouter.get("/", relayMiddleware);

export default dashboardRouter;
