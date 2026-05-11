import mysql from 'mysql2/promise';

async function check() {
  const connection = await mysql.createConnection({
    host: "13.206.205.158",
    port: 3306,
    user: "abhik",
    password: "abhikSQL",
    database: "abhik_db"
  });

  const [uRows] = await connection.execute("SELECT id, full_name FROM users_access WHERE full_name LIKE '%Jenish%'");
  console.log("Users:", JSON.stringify(uRows, null, 2));

  if (uRows.length > 0) {
    const uids = uRows.map(u => u.id);
    const [rRows] = await connection.execute(`SELECT * FROM access_requests WHERE target_user_id IN (${uids.map(id => `'${id}'`).join(',')}) OR user_id IN (${uids.map(id => `'${id}'`).join(',')})`);
    console.log("Requests:", JSON.stringify(rRows, null, 2));
  }

  await connection.end();
}

check().catch(console.error);
