import { db } from '../src/db/client.js';

async function create() {
  try {
    await db.query(`
      INSERT INTO users (id, full_name, email, role_id, manager_id) 
      VALUES ("testuser", "Test Onboarding User", "test@example.com", "end_user", "adas")
      ON DUPLICATE KEY UPDATE manager_id="adas"
    `);
    
    console.log('Created testuser under adas');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
create();
