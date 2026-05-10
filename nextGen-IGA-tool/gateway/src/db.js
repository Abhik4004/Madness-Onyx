import mysql from "mysql2/promise";
import "dotenv/config";

const pool = mysql.createPool({
  host: process.env.DB_HOST || "13.206.205.158",
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || "abhik",
  password: process.env.DB_PASSWORD || "abhikSQL",
  database: process.env.DB_NAME || "abhik_db",
  waitForConnections: true,
  connectionLimit: 5
});

export const db = {
  query: async (sql, params) => {
    const [results] = await pool.execute(sql, params);
    return { rows: results };
  }
};
