const mysql = require('mysql2/promise');
async function run() {
  const conn = await mysql.createConnection({
    host: '13.206.205.158',
    user: 'abhik',
    password: 'abhikSQL',
    database: 'abhik_db'
  });
  
  console.log('Creating ROLES table...');
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS roles (
      id VARCHAR(50) PRIMARY KEY,
      role_name VARCHAR(100),
      role_type VARCHAR(50),
      description TEXT
    )
  `);

  console.log('Seeding ROLES...');
  const roles = [
    ['admin', 'System Administrator', 'ADMIN', 'Full access to all modules'],
    ['supervisor', 'Team Manager', 'MANAGER', 'Certification and team management access'],
    ['user', 'End User', 'USER', 'Standard access for requesting resources'],
    ['end_user', 'End User', 'USER', 'Standard access for requesting resources']
  ];
  
  for (const r of roles) {
    await conn.execute('INSERT IGNORE INTO roles (id, role_name, role_type, description) VALUES (?, ?, ?, ?)', r);
  }

  console.log('Setup complete.');
  process.exit(0);
}
run().catch(err => { console.error(err); process.exit(1); });
