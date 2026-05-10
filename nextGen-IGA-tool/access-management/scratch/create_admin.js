import mysql from 'mysql2/promise';
(async () => {
  const conn = await mysql.createConnection('mysql://abhik:abhikSQL@13.206.205.158:3306/abhik_db');
  await conn.execute(`
    UPDATE users_access SET role_id='admin', status='ACTIVE', isApproved=TRUE WHERE id='adas'
  `);
  console.log('User adas promoted to admin!');
  process.exit(0);
})().catch(err => {
  console.error(err);
  process.exit(1);
});
