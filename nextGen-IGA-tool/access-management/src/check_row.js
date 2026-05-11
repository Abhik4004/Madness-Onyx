import mysql from 'mysql2/promise';

async function check() {
  const connection = await mysql.createConnection({
    host: "13.206.205.158",
    port: 3306,
    user: "abhik",
    password: "abhikSQL",
    database: "abhik_db"
  });

  const [rows] = await connection.execute("SELECT * FROM access_requests WHERE id = '92c009fb-0dbb-41b4-bc90-5fec574f345f'");
  console.log(JSON.stringify(rows, null, 2));

  await connection.end();
}

check().catch(console.error);
