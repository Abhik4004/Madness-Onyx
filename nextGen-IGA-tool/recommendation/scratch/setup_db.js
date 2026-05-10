const mysql = require('mysql2/promise');
async function run() {
  const conn = await mysql.createConnection({
    host: '13.206.205.158',
    user: 'abhik',
    password: 'abhikSQL',
    database: 'abhik_db'
  });
  
  console.log('Creating role_access_summary...');
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS role_access_summary (
      role_id VARCHAR(255),
      manager_id VARCHAR(255),
      total_people INT,
      access_type VARCHAR(100),
      users_with_access INT,
      risk_level VARCHAR(50),
      requestable_by VARCHAR(50),
      PRIMARY KEY (role_id, manager_id, access_type)
    )
  `);
  
  console.log('Populating role_access_summary from existing data...');
  // Simple seed to avoid empty table
  await conn.execute(`
    INSERT IGNORE INTO role_access_summary 
    (role_id, manager_id, total_people, access_type, users_with_access, risk_level, requestable_by)
    SELECT 
      u.role_id, 
      COALESCE(u.manager_id, 'SYSTEM') as manager_id,
      COUNT(DISTINCT u.id) as total_people,
      COALESCE(ua.application_id, 'NONE') as access_type,
      COUNT(DISTINCT CASE WHEN ua.status = 'ACTIVE' THEN u.id END) as users_with_access,
      'LOW' as risk_level,
      'SELF' as requestable_by
    FROM users u
    LEFT JOIN user_access ua ON u.id = ua.user_id
    GROUP BY u.role_id, u.manager_id, ua.application_id
  `);
  
  console.log('Setup complete.');
  process.exit(0);
}
run().catch(err => { console.error(err); process.exit(1); });
