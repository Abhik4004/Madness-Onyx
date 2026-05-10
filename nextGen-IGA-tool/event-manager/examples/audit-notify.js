/**
 * Example: AI Auditing service publishes a completion event
 * to `user.notify.{userId}` so the gateway WebSocket layer
 * can push it to the browser.
 *
 * Drop this pattern into any downstream microservice.
 */

import { connect, JSONCodec } from "nats";

const jc = JSONCodec();
const nc = await connect({
  servers: process.env.NATS_URL || "nats://54.224.250.252:4222",
});
const js = nc.jetstream();

/**
 * Call this when a long-running audit report finishes.
 * @param {string} userId
 * @param {Object} result
 */
export async function notifyReportReady(userId, result) {
  const subject = `user.notify.${userId}`;

  /** @type {import("../schemas.js").NotifyEnvelope} */
  const envelope = {
    userId,
    event: "audit.report.ready",
    payload: {
      reportId: result.reportId,
      downloadUrl: result.downloadUrl,
      summary: result.summary,
    },
    timestamp: Date.now(),
  };

  await js.publish(subject, jc.encode(envelope));
  console.log(`[audit-svc] notified user ${userId} on ${subject}`);
}

// ── Simulate a finished report ───────────────────────────────────────────────
await notifyReportReady("user-abc-123", {
  reportId: "rpt-2026-001",
  downloadUrl: "/api/audit/report/rpt-2026-001",
  summary: "42 anomalies detected across 3 resources",
});

await nc.drain();
