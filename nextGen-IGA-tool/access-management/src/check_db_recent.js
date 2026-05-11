import mysql from 'mysql2/promise';

async function check() {
  const connection = await mysql.createConnection({
    host: "13.206.205.158",
    port: 3306,
    user: "abhik",
    password: "abhikSQL",
    database: "abhik_db"
  });

  const [rows] = await connection.execute("SELECT id, user_id, target_user_id, status, submitted_at, decided_at, duration_seconds FROM access_requests WHERE status IN ('APPROVED', 'PROVISIONED', 'EXPIRED') ORDER BY submitted_at DESC LIMIT 20;");
  console.log(JSON.stringify(rows, null, 2));

  await connection.end();
}

check().catch(console.error);
