import { db } from './src/db/client.js';

async function test() {
  try {
    const { rows } = await db.query("SELECT id, full_name, email, role_id, status FROM users_access LIMIT 20;");
    console.log("=== USERS_ACCESS TABLE DATA ===");
    console.table(rows);
    process.exit(0);
  } catch (err) {
    console.error("DB Error:", err.message);
    process.exit(1);
  }
}

test();
