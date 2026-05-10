import { db } from '../src/db/client.js';

async function check() {
  try {
    const { rows } = await db.query('SELECT id, role_id FROM users WHERE id IN ("admin", "adas")');
    console.table(rows);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
check();
