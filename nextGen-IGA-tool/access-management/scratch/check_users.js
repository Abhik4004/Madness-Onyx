import { db } from "../src/db/client.js";

async function check() {
  try {
    const { rows } = await db.query("SELECT id, manager_id FROM users_access LIMIT 20");
    console.log("Users and Managers:", JSON.stringify(rows, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

check();
