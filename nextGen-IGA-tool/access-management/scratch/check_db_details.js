import { db } from '../src/db/client.js';

async function check() {
  try {
    const { rows: items } = await db.query(`
      SELECT i.id, i.certification_id, i.user_id, i.application_id, i.manager_id, i.decision 
      FROM certification_items i 
      WHERE manager_id = 'adas'
    `);
    console.log("Items for adas:", items);
  } catch (e) {
    console.error(e);
  } finally {
    process.exit();
  }
}

check();
