/**
 * Gateway relay — wraps every inbound HTTP request into a GatewayEnvelope
 * and sends it to `api.gateway.events` (NATS Core request/reply).
 * EventManager receives it, routes sync or async, replies back.
 */

import { randomUUID } from "crypto";
import { JSONCodec } from "nats";
import { getNATS } from "./client.js";

const jc = JSONCodec();
const RELAY_TIMEOUT_MS = Number(process.env.RELAY_TIMEOUT_MS) || 6000;

/**
 * Build a GatewayEnvelope from an Express request.
 * @param {import("express").Request} req
 * @returns {import("../../../event-manager/schemas.js").GatewayEnvelope}
 */
function buildEnvelope(req) {
  return {
    requestId: randomUUID(),
    userId:    req.userId ?? null,
    role:      req.role   ?? null,
    method:    req.method,
    path:      (req.baseUrl + req.path).replace(/\/$/, "") || "/", // Clean up trailing slash from mount point root
    token:     req.headers.authorization?.replace("Bearer ", "") || null,
    body:      req.body   ?? {},
    query:     req.query  ?? {},
    params:    req.params ?? {},
    timestamp: Date.now(),
  };
}

/**
 * Send envelope to EventManager; return parsed ServiceReply.
 * Throws on timeout / NATS error so callers can catch uniformly.
 */
export async function relay(req) {
  const { nc } = getNATS();
  const envelope = buildEnvelope(req);

  console.log(`[relay] Sending request to NATS: ${envelope.method} ${envelope.path} -> api.gateway.events`);

  const msg = await nc.request("api.gateway.events", jc.encode(envelope), {
    timeout: RELAY_TIMEOUT_MS,
  });

  const decoded = jc.decode(msg.data);
  
  const reply = (decoded && typeof decoded === 'object' && 'ok' in decoded)
    ? decoded
    : { ok: true, data: decoded };

  const status = reply.status ?? decoded.status ?? 200;

  const finalReply = { ...reply, status };
  
  console.log(`[relay] FINAL RESPONSE TO BROWSER for ${envelope.requestId}:`, {
    status: finalReply.status,
    ok: finalReply.ok,
    dataType: typeof finalReply.data,
    isArray: Array.isArray(finalReply.data),
    dataCount: Array.isArray(finalReply.data) ? finalReply.data.length : (finalReply.data ? 1 : 0),
    dataKeys: (finalReply.data && typeof finalReply.data === 'object') ? Object.keys(finalReply.data).slice(0, 10) : 'n/a',
    snippet: JSON.stringify(finalReply.data).slice(0, 200)
  });

  return finalReply;
}

/**
 * Express middleware factory — relays request and writes HTTP response.
 * Use when the entire route is handed off to EventManager.
 */
export function relayMiddleware(req, res) {
  relay(req)
    .then((reply) => {
      const httpStatus = reply.status >= 200 && reply.status < 600 ? reply.status : 200;
      res.status(httpStatus).json(reply);
    })
    .catch((err) => {
      const timeout = err.message?.includes("timeout");
      res.status(timeout ? 504 : 502).json({
        ok: false,
        status: timeout ? 504 : 502,
        message: timeout ? "Upstream timeout" : "Gateway relay error",
      });
    });
}

/**
 * Publish a non-blocking event to NATS.
 */
export async function publish(subject, body, req = {}) {
  const { nc } = getNATS();
  const envelope = {
    requestId: randomUUID(),
    userId:    req.userId ?? null,
    role:      req.role   ?? null,
    body:      body   ?? {},
    timestamp: Date.now(),
  };
  nc.publish(subject, jc.encode(envelope));
  console.log(`[relay] Published async event to ${subject}`);
}
