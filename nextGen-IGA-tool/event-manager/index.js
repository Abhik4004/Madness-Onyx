/**
 * EventManager
 *
 * Listens on NATS Core subject `api.gateway.events` (request/reply from gateway).
 * Inspects GatewayEnvelope → resolves route → either:
 *   sync  → NATS Core request to downstream, relay reply back to gateway
 *   async → JetStream publish, immediately reply 202 to gateway
 */

console.log("[event-manager] index.js loaded - HARD RESTART #2");
import { connect, StringCodec, JSONCodec } from "nats";
import { provisionStreams } from "./streams.js";
import { ROUTES, resolveRoute } from "./router.js";

const NATS_URL = process.env.NATS_URL || "nats://54.224.250.252:4222";
const GATEWAY_SUBJECT = process.env.GATEWAY_SUBJECT || "api.gateway.events";
const SYNC_TIMEOUT_MS = Number(process.env.SYNC_TIMEOUT_MS) || 5000;

const sc = StringCodec();
const jc = JSONCodec();

function encode(obj) {
  return jc.encode(obj);
}
function decode(data) {
  return jc.decode(data);
}

async function main() {
  const nc = await connect({ servers: NATS_URL });
  console.log("[event-manager] connected to NATS");
  
  console.log("=== EVENT MANAGER ROUTING TABLE ===");
  ROUTES.forEach(r => console.log(`[route] ${r.method} ${r.pattern} -> ${r.subject} (${r.mode})`));
  console.log("====================================");

  const jsm = await nc.jetstreamManager();
  await provisionStreams(jsm);

  const js = nc.jetstream();

  const sub = nc.subscribe(GATEWAY_SUBJECT);
  console.log(`[event-manager] listening on ${GATEWAY_SUBJECT}`);

  for await (const msg of sub) {
    handleMessage(nc, js, msg).catch((err) => {
      console.error("[event-manager] unhandled error:", err.message);
      replyError(msg, 500, "EventManager internal error");
    });
  }
}

async function handleMessage(nc, js, msg) {
  let envelope;
  try {
    envelope = decode(msg.data);
  } catch {
    return replyError(msg, 400, "Malformed envelope");
  }

  const { method, path, requestId } = envelope;
  console.log(`[event-manager] incoming: ${method} ${path}`);
  
  // HARD OVERRIDE for User List to kill the ghost
  let route = resolveRoute(method, path);
  if (path.includes("/users") && method === "GET") {
    console.log(`[${requestId}] !!! HARD OVERRIDE TRIGGERED for ${path} !!!`);
    route = { mode: "sync", subject: "admin.users.list.v2" };
  }

  if (!route) {
    return replyError(msg, 404, `No route for ${method} ${path}`);
  }

  console.log(
    `[${requestId}] ${method} ${path} → [${route.mode}] ${route.subject}`,
  );

  if (route.mode === "sync") {
    await handleSync(nc, js, msg, envelope, route);
  } else {
    await handleAsync(js, msg, envelope, route);
  }
}

async function handleSync(nc, js, msg, envelope, route) {
  // Publish to JetStream audit trail (Disabled for sync to prevent LDAP_STREAM interception)
  // publishAudit(js, envelope, route).catch(() => {});

  try {
    const payload = (route.payload === "body") ? envelope.body : envelope;

    console.log("--------------------------------------------------");
    console.log(`[sync] ROUTE MATCHED: ${route.subject}`);
    console.log(`[sync] SENDING PAYLOAD:`, JSON.stringify(payload));
    console.log("--------------------------------------------------");

    const reply = await nc.request(route.subject, encode(payload), {
      timeout: SYNC_TIMEOUT_MS,
    });

    // Decode and log what the downstream service actually sent back
    try {
      const decoded = decode(reply.data);
      console.log(`[sync] Reply received from [${route.subject}]:`, JSON.stringify(decoded));
    } catch {
      console.log(`[sync] Reply received from [${route.subject}]: raw bytes length=${reply.data?.length}`);
    }

    msg.respond(reply.data);
  } catch (err) {
    console.error(`[sync] Timeout/error for [${route.subject}]: ${err.message}`);
    const status = err.message?.includes("timeout") ? 504 : 502;
    replyError(msg, status, `Downstream error: ${err.message}`);
  }
}

async function handleAsync(js, msg, envelope, route) {
  try {
    console.log(`[event-manager] publishing to JetStream: subject=${route.subject} body=`, envelope.body);
    await js.publish(route.subject, encode(envelope.body));

    msg.respond(
      encode({
        ok: true,
        status: 202,
        message: "Accepted – processing asynchronously",
        requestId: envelope.requestId,
      }),
    );

    // Also emit to audit stream
    publishAudit(js, envelope, { subject: route.subject, mode: "async" }).catch(
      () => {},
    );
  } catch (err) {
    console.error(`[event-manager] JetStream publish failed for ${route.subject}:`, err);
    replyError(msg, 503, `JetStream publish failed: ${err.message}`);
  }
}

async function publishAudit(js, envelope, route) {
  const auditSubject = deriveAuditSubject(envelope.path);
  await js.publish(
    auditSubject,
    encode({
      requestId: envelope.requestId,
      userId: envelope.userId,
      role: envelope.role,
      method: envelope.method,
      path: envelope.path,
      routedTo: route.subject,
      mode: route.mode,
      timestamp: envelope.timestamp,
    }),
  );
}

function deriveAuditSubject(path) {
  if (
    path.includes("/user/login") ||
    path.includes("/user/logout") ||
    path.includes("/user/register") ||
    path.includes("/user/refresh")
  )
    return "events.audit.auth";
  if (path.includes("/admin/users")) return "events.audit.admin.users";
  if (path.includes("/provision") || path.includes("/deprovision"))
    return "events.audit.provision";
  if (path.includes("/access/cert")) return "events.audit.access.cert";
  if (path.includes("/access/time")) return "events.audit.access.time";
  if (path.includes("/access")) return "events.audit.access";
  if (path.includes("/recommendation")) return "events.audit.recommendation";
  return "events.audit.general";
}

function replyError(msg, status, message) {
  if (msg.reply) {
    msg.respond(encode({ ok: false, status, message }));
  }
}

main().catch((err) => {
  console.error("[event-manager] fatal:", err);
  process.exit(1);
});
