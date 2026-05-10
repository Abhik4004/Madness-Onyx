/**
 * JetStream Stream Provisioner
 * Run once at startup to declare all streams.
 */

import { RetentionPolicy, StorageType } from "nats";

const STREAMS = [
  {
    name: "EVENTS_AUTH",
    subjects: ["events.auth.*"],
    retention: RetentionPolicy.Workqueue,
    storage: StorageType.File,
    max_age: 3_600_000_000_000, // 1 hour in nanoseconds
    num_replicas: 1,
  },
  {
    name: "EVENTS_USER_CREATION",
    subjects: ["events.user.creation.>"],
    retention: RetentionPolicy.Workqueue,
    storage: StorageType.File,
    max_age: 3_600_000_000_000,
    num_replicas: 1,
  },
  {
    name: "EVENTS_PROVISION",
    subjects: ["events.provision.>", "events.deprovision.>"],
    retention: RetentionPolicy.Workqueue,
    storage: StorageType.File,
    max_age: 86_400_000_000_000, // 24 h
    num_replicas: 1,
  },
  {
    name: "EVENTS_ACCESS",
    subjects: [
      "events.access.>",
      "access.request.create",
      "access.request.update",
      "access.granted",
      "access.revoked",
      "certification.task.generate",
      "certification.recommendation.generated"
    ],
    retention: RetentionPolicy.Workqueue,
    storage: StorageType.File,
    max_age: 86_400_000_000_000,
    num_replicas: 1,
  },
  {
    name: "EVENTS_RECOMMENDATION",
    subjects: ["events.recommendation.>", "ai.recommendation.>"],
    retention: RetentionPolicy.Workqueue,
    storage: StorageType.File,
    max_age: 86_400_000_000_000,
    num_replicas: 1,
  },
  {
    name: "EVENTS_AUDIT",
    subjects: ["events.audit.>", "audit.log.>"],
    retention: RetentionPolicy.Limits, // keep for compliance
    storage: StorageType.File,
    max_age: 2_592_000_000_000_000, // 30 days
    num_replicas: 1,
  },
  {
    name: "EVENTS_NOTIFY",
    subjects: ["events.notify.>"],
    retention: RetentionPolicy.Workqueue,
    storage: StorageType.File,
    max_age: 86_400_000_000_000,
    num_replicas: 1,
  },
  {
    name: "USER_NOTIFY",
    subjects: ["user.notify.*"],
    retention: RetentionPolicy.Limits,
    storage: StorageType.Memory,
    max_age: 300_000_000_000,
    num_replicas: 1,
  },
];

export async function provisionStreams(jsm) {
  for (const cfg of STREAMS) {
    try {
      await jsm.streams.add(cfg);
      console.log(`[streams] created: ${cfg.name}`);
    } catch (e) {
      if (e.message?.includes("stream name already in use")) {
        await jsm.streams.update(cfg.name, cfg);
        console.log(`[streams] updated: ${cfg.name}`);
      } else {
        throw e;
      }
    }
  }
}

export { STREAMS };
