import { connect, StringCodec } from "nats";

let nc;
const sc = StringCodec();

export async function connectNats() {
  if (!nc) {
    nc = await connect({
      servers: process.env.NATS_URL || "nats://54.224.250.252:4222",
    });
    console.log("Connected to NATS");
  }

  return nc;
}

export function getNATS() {
  if (!nc) {
    throw new Error("NATS not connected");
  }
  return { nc, sc };
}
