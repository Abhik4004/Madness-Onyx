import mysql from 'mysql2/promise';

const dbConfig = {
  host: "13.206.205.158",
  port: 3306,
  user: "abhik",
  password: "abhikSQL",
  database: "abhik_db",
};

async function seed() {
  const conn = await mysql.createConnection(dbConfig);
  console.log("Connected to MySQL for seeding");

  try {
    // 1. Ensure Aghosh exists and is ACTIVE
    await conn.execute(
      `INSERT INTO users_access (id, full_name, email, role_id, status, isApproved) 
       VALUES (?, ?, ?, ?, ?, ?) 
       ON DUPLICATE KEY UPDATE status = 'ACTIVE', isApproved = 1`,
      ['aghosh', 'Abhik Ghosh', 'abhik@example.com', 'end_user', 'ACTIVE', 1]
    );

    // 2. Ensure Applications exist
    await conn.execute(
      `INSERT INTO applications (id, app_name, description) 
       VALUES (?, ?, ?) 
       ON DUPLICATE KEY UPDATE app_name = VALUES(app_name)`,
      ['salesforce', 'Salesforce CRM', 'Customer relationship management platform']
    );

    // 3. Insert Requests with FULL metadata
    await conn.execute(`DELETE FROM access_requests`);
    
    const requests = [
      {
        id: '1f1cb00b-7b63-4ac6-b9a5-7b25e4b4b59f',
        user_id: 'aghosh',
        target_user_id: 'aghosh',
        app_id: 'salesforce',
        app_name: 'Salesforce CRM',
        role: 'Editor',
        approver: 'jpaul',
        status: 'PENDING'
      },
      {
        id: '2f2cb00b-7b63-4ac6-b9a5-7b25e4b4b59f',
        user_id: 'admin',
        target_user_id: 'aghosh',
        app_id: 'github',
        app_name: 'GitHub Enterprise',
        role: 'Maintainer',
        approver: 'admin',
        status: 'PENDING'
      },
      {
        id: '3f3cb00b-7b63-4ac6-b9a5-7b25e4b4b59f',
        user_id: 'aghosh',
        target_user_id: 'aghosh',
        app_id: 'aws',
        app_name: 'AWS Cloud Console',
        role: 'Admin',
        approver: 'admin',
        status: 'APPROVED'
      }
    ];

    for (const r of requests) {
      await conn.execute(
        `INSERT INTO access_requests 
         (id, user_id, target_user_id, application_id, application_name, requested_role, justification, status, approver_id, assigned_approver_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [r.id, r.user_id, r.target_user_id, r.app_id, r.app_name, r.role, 'Seeded test request', r.status, r.approver, r.approver]
      );
    }

    console.log("Seeding completed successfully!");
  } catch (err) {
    console.error("Seeding failed:", err.message);
  } finally {
    await conn.end();
  }
}

seed();
