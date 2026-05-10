import { connect, JSONCodec } from "nats";
import "dotenv/config";

const NATS_URL = process.env.NATS_URL || "nats://54.224.250.252:4222";

export const jc = JSONCodec();

let _nc;
let _js;
let _jsm;

export async function connectNats() {
  _nc = await connect({ servers: NATS_URL });

  _jsm = await _nc.jetstreamManager();
  _js = _nc.jetstream();

  console.log("[nats] Connected:", NATS_URL);

  return { nc: _nc, js: _js, jsm: _jsm };
}

export const getNats = () => ({
  nc: _nc,
  js: _js,
  jsm: _jsm,
});
