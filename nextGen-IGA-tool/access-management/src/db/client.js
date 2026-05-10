import mysql from "mysql2/promise";
import "dotenv/config";

const pool = mysql.createPool({
  host: process.env.DB_HOST || "13.206.205.158",
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || "abhik",
  password: process.env.DB_PASSWORD || "abhikSQL",
  database: process.env.DB_NAME || "abhik_db",
  allowPublicKeyRetrieval: true,
  waitForConnections: true,
  connectionLimit: 10
});

export const db = {
  query: async (sql, params) => {
    // Normalize $1/$2 PostgreSQL placeholders → ? MySQL style
    const normalizedSql = sql.replace(/\$\d+/g, "?");
    try {
      const [results] = await pool.execute(normalizedSql, params ?? []);
      return { rows: results };
    } catch (err) {
      console.error(`[db] Query Failed: ${normalizedSql.slice(0, 100)} | Error: ${err.message}`);
      throw err;
    }
  },
};

(async () => {
  try {
    const conn = await pool.getConnection();
    console.log("[db] Connected to MySQL ✅");
    conn.release();
  } catch (err) {
    console.error("[db] MySQL Connection failed ❌", err.message);
  }
})();
