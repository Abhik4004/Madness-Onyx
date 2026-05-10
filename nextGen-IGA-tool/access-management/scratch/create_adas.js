import { db } from '../src/db/client.js';

async function create() {
  try {
    await db.query(`
      INSERT INTO users (id, full_name, email, role_id) 
      VALUES ("adas", "Abhik Das", "adas@example.com", "supervisor")
      ON DUPLICATE KEY UPDATE role_id="supervisor"
    `);
    
    await db.query(`
      UPDATE users SET manager_id = "adas" 
      WHERE id IN ("alice", "bob", "charlie")
    `);
    
    console.log('Created manager adas and assigned reports: alice, bob, charlie');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
create();
