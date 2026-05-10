import { Router } from "express";
import { relayMiddleware } from "../../nats/relay.js";

const userCreation = Router();

userCreation.post("/register", relayMiddleware);
userCreation.post("/sync", relayMiddleware);
userCreation.get("/:id/access", relayMiddleware);
userCreation.post("/access/details", relayMiddleware);

export default userCreation;
