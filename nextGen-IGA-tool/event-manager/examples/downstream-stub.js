/**
 * Minimal downstream service stub.
 * Paste per-service; swap subject + handler logic.
 *
 * Sync services → nc.subscribe  (reply directly)
 * Async services → js consumer  (ack, process, then optionally notify)
 */

import { connect, JSONCodec, AckPolicy, DeliverPolicy } from "nats";

const jc = JSONCodec();
const nc = await connect({
  servers: process.env.NATS_URL || "nats://54.224.250.252:4222",
});
const js = nc.jetstream();
const jsm = await nc.jetstreamManager();

// ── Example: Auth service (sync) ─────────────────────────────────────────────
const authSub = nc.subscribe("auth.login");
(async () => {
  for await (const msg of authSub) {
    const envelope = jc.decode(msg.data);
    const { email, password } = envelope.body;

    // ... validate credentials against DB ...
    const ok = email && password;

    msg.respond(
      jc.encode({
        ok,
        status: ok ? 200 : 401,
        message: ok ? "Login successful" : "Invalid credentials",
        data: ok
          ? { token: "eyJ...", userId: "user-abc-123", role: "admin" }
          : null,
      }),
    );
  }
})();

// ── Example: Provision service (async) ────────────────────────────────────────
await jsm.consumers.add("EVENTS_PROVISION", {
  durable_name: "provision-svc",
  filter_subject: "events.provision.*",
  ack_policy: AckPolicy.Explicit,
  deliver_policy: DeliverPolicy.All,
});

const consumer = await js.consumers.get("EVENTS_PROVISION", "provision-svc");
const messages = await consumer.consume();

(async () => {
  for await (const msg of messages) {
    const envelope = jc.decode(msg.data);
    console.log(`[provision-svc] processing ${envelope.requestId}`);

    // ... bulk-create users in DB ...

    msg.ack();

    // Notify user when done
    await js.publish(
      `user.notify.${envelope.userId}`,
      jc.encode({
        userId: envelope.userId,
        event: "provision.bulk.complete",
        payload: { totalCreated: envelope.body?.users?.length ?? 0 },
        timestamp: Date.now(),
      }),
    );
  }
})();

console.log("[stub] Auth (sync) + Provision (async) listening");
