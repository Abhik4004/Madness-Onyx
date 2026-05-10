import { Router } from "express";
import { relayMiddleware } from "../../nats/relay.js";

const fetchUser = Router();

fetchUser.get("/", relayMiddleware);

export default fetchUser;
