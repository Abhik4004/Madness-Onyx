import { db } from "../src/db/client.js";

async function check() {
  try {
    const { rows } = await db.query("SELECT id, assigned_approver_id FROM access_requests WHERE status = 'PENDING'");
    console.log("Pending Requests:", JSON.stringify(rows, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

check();
