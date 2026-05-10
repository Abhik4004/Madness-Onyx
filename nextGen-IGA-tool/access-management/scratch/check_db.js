import { db } from '../src/db/client.js';

async function check() {
  try {
    const { rows: certs } = await db.query("SELECT id, name, status FROM access_certifications");
    console.log("Certifications:", certs);
    const { rows: items } = await db.query("SELECT count(*) as count, manager_id, decision FROM certification_items GROUP BY manager_id, decision");
    console.log("Items Summary:", items);
  } catch (e) {
    console.error(e);
  } finally {
    process.exit();
  }
}

check();
