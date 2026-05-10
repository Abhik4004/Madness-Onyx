/**
 * WebSocket notification layer.
 *
 * On connect: client sends { token } → gateway validates JWT → registers
 * socket under userId.
 *
 * JetStream consumer watches `user.notify.*` (USER_NOTIFY stream).
 * When a message arrives for userId, push to registered socket.
 */

import { WebSocketServer } from "ws";
import jwt from "jsonwebtoken";
import { JSONCodec, AckPolicy, DeliverPolicy } from "nats";
import { getNATS } from "../nats/client.js";
import { JWT_SECRET } from "../middleware/jwt.js";

const jc = JSONCodec();

/** @type {Map<string, Set<import("ws").WebSocket>>} */
const sockets = new Map();

export async function startNotifyConsumer(jsm, js) {
  // Ensure durable consumer exists on USER_NOTIFY stream
  try {
    await jsm.consumers.add("USER_NOTIFY", {
      durable_name:   "gateway-notify",
      filter_subject: "user.notify.*",
      ack_policy:     AckPolicy.Explicit,
      deliver_policy: DeliverPolicy.New,
    });
  } catch (e) {
    if (!e.message?.includes("consumer name already in use")) throw e;
  }

  const consumer = await js.consumers.get("USER_NOTIFY", "gateway-notify");
  const messages = await consumer.consume();

  (async () => {
    for await (const msg of messages) {
      try {
        const envelope = jc.decode(msg.data);
        push(envelope.userId, envelope);
      } catch { /* malformed — drop */ }
      msg.ack();
    }
  })();

  console.log("[notify] JetStream consumer started on USER_NOTIFY");
}

/**
 * Push payload to all sockets registered for userId.
 */
function push(userId, payload) {
  const clients = sockets.get(userId);
  if (!clients?.size) return;
  const frame = JSON.stringify(payload);
  for (const ws of clients) {
    if (ws.readyState === ws.OPEN) ws.send(frame);
  }
}

/**
 * Attach WebSocket server to an existing HTTP server.
 * @param {import("http").Server} server
 */
export function attachWss(server) {
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws) => {
    let userId = null;

    ws.on("message", (raw) => {
      // First message must be auth handshake: { token: "..." }
      if (userId) return; // already authed, ignore further messages
      try {
        const { token } = JSON.parse(raw.toString());
        const payload = jwt.verify(token, JWT_SECRET);
        userId = payload.sub ?? payload.userId;

        if (!sockets.has(userId)) sockets.set(userId, new Set());
        sockets.get(userId).add(ws);

        ws.send(JSON.stringify({ ok: true, event: "connected", userId }));
        console.log(`[notify] WS registered userId=${userId}`);
      } catch {
        ws.send(JSON.stringify({ ok: false, event: "auth_failed" }));
        ws.close();
      }
    });

    ws.on("close", () => {
      if (userId) sockets.get(userId)?.delete(ws);
    });
  });

  console.log("[notify] WebSocket server attached at /ws");
}
