import mysql from 'mysql2/promise';

async function check() {
  const connection = await mysql.createConnection({
    host: "13.206.205.158",
    port: 3306,
    user: "abhik",
    password: "abhikSQL",
    database: "abhik_db"
  });

  const [rows] = await connection.execute("SELECT * FROM access_requests WHERE role_name = 'viewer' AND status IN ('APPROVED', 'PROVISIONED', 'EXPIRED') ORDER BY id DESC LIMIT 50;");
  console.log(JSON.stringify(rows, null, 2));

  await connection.end();
}

check().catch(console.error);

