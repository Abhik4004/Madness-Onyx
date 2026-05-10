import { db } from "../src/db/client.js";
import { randomUUID } from "crypto";

async function seed() {
  try {
    const id = randomUUID();
    console.log("Seeding test request:", id);
    
    // 1. Ensure user exists
    await db.query("INSERT INTO users_access (id, full_name, email, status, isApproved) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE status='ACTIVE'", 
      ['aghosh', 'Arpita Ghosh', 'arpita@example.com', 'ACTIVE', 1]);
    
    // 2. Ensure manager exists
    await db.query("INSERT INTO users_access (id, full_name, email, status, isApproved) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE status='ACTIVE'", 
      ['jpaul', 'Joy Paul', 'joy@example.com', 'ACTIVE', 1]);
      
    // 3. Ensure application exists
    await db.query("INSERT INTO applications (id, app_name) VALUES (?, ?) ON DUPLICATE KEY UPDATE app_name=app_name", 
      ['salesforce', 'Salesforce']);

    // 4. Create request
    await db.query(
      `INSERT INTO access_requests 
       (id, user_id, target_user_id, application_id, requested_role, justification, status, approver_id, assigned_approver_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [id, 'aghosh', 'aghosh', 'salesforce', 'Editor', 'Need access for project alpha', 'PENDING', 'jpaul', 'jpaul']
    );

    console.log("Seeded successfully. User 'jpaul' should now see 1 approval request.");
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

seed();
