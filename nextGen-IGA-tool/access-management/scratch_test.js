import { handleUserList } from "./src/handlers/sync.js";
import { jc } from "./src/nats/connector.js";

async function test() {
  const mockMsg = {
    data: jc.encode({ userId: 'admin', role: 'admin' }),
    respond: (data) => {
      const decoded = jc.decode(data);
      const u = decoded.data.find(x => x.uid === 'nrobinson02');
      console.log("MOCK RESPONSE FOR nrobinson02:", JSON.stringify(u, null, 2));
    }
  };
  await handleUserList(mockMsg);
}

test().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
