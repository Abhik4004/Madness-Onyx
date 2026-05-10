import { db } from '../src/db/client.js';

async function check() {
  try {
    const { rows: reports } = await db.query('SELECT id FROM users WHERE manager_id = "adas"');
    console.log('Reports for adas:', reports.length);
    
    const { rows: access } = await db.query('SELECT COUNT(*) as c FROM user_access WHERE status = "ACTIVE"');
    console.log('Total active access records:', access[0].c);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
check();
