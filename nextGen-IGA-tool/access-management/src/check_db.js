import mysql from 'mysql2/promise';

async function check() {
  const connection = await mysql.createConnection({
    host: "13.206.205.158",
    port: 3306,
    user: "abhik",
    password: "abhikSQL",
    database: "abhik_db"
  });

  const [rows] = await connection.execute("SELECT id, user_id, status, decided_at, duration_seconds FROM access_requests WHERE application_name = 'Saviynt' LIMIT 10;");
  console.log(JSON.stringify(rows, null, 2));
  
  const [now] = await connection.execute("SELECT UTC_TIMESTAMP() as now;");
  console.log("DB UTC_TIMESTAMP:", now[0].now);

  await connection.end();
}

check().catch(console.error);
