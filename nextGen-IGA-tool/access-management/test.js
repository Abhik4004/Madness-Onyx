import { connect, JSONCodec } from "nats";

const jc = JSONCodec();

const nc = await connect({ servers: "nats://54.224.250.252:4222" });

// 🔹 TEST SYNC (like GET)
const res = await nc.request("access.request.list", jc.encode({}));

console.log("SYNC RESPONSE:", jc.decode(res.data));

// 🔹 TEST ASYNC (like POST)
await nc.publish(
  "events.access.request.create",
  jc.encode({
    userId: "test-user",
    body: {
      resourceId: "app-1",
      justification: "testing",
    },
  }),
);

console.log("ASYNC EVENT SENT");

await nc.close();
