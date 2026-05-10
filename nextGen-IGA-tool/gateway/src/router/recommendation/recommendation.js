import { Router } from "express";
import { relayMiddleware } from "../../nats/relay.js";

const recRouter = Router();

recRouter.post("/run",    relayMiddleware);
recRouter.get("/onboarding/:userId", relayMiddleware);
recRouter.get("/team/:managerId",     relayMiddleware);
recRouter.get("/:userId", relayMiddleware);

export default recRouter;
