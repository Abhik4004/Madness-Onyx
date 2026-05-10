import { db } from "./src/db/client.js";

async function check() {
  try {
    const { rows } = await db.query("SELECT id, app_name, owner_id FROM applications ORDER BY created_at DESC LIMIT 10");
    console.log("Current Applications in DB:");
    console.table(rows);
    process.exit(0);
  } catch (e) {
    console.error("DB Check Error:", e.message);
    process.exit(1);
  }
}

check();
