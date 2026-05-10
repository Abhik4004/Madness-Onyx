import { Router } from "express";
import { relayMiddleware } from "../../nats/relay.js";

const notificationsRouter = Router();

notificationsRouter.use(relayMiddleware);

export default notificationsRouter;
