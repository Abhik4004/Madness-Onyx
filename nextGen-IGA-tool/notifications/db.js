import mysql from "mysql2/promise";
import "dotenv/config";

const dbConfig = {
  host: process.env.DB_HOST || "13.206.205.158",
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || "abhik",
  password: process.env.DB_PASSWORD || "abhikSQL",
  database: process.env.DB_NAME || "abhik_db",
  allowPublicKeyRetrieval: process.env.DB_ALLOW_PUBLIC_KEY_RETRIEVAL === "true",
  ssl: process.env.DB_SSL === "true" ? {} : false,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

export const pool = mysql.createPool(dbConfig);

export const db = {
  query: async (sql, params) => {
    const normalizedSql = sql.replace(/\$\d+/g, "?");
    const [results] = await pool.execute(normalizedSql, params);
    return { rows: results };
  },
};

(async () => {
  try {
    const conn = await pool.getConnection();
    console.log("[db] Notifications connected to MySQL ✅");
    conn.release();
  } catch (err) {
    console.error("[db] MySQL Connection failed ❌", err.message);
  }
})();
