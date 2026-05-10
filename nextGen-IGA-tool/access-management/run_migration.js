import fs from "fs";
import { db } from "./src/db/client.js";

async function runMigration() {
  try {
    const sql = fs.readFileSync("migrations/001_access_requests.sql", "utf8");
    await db.query(sql);
    console.log("Migration applied successfully!");
    process.exit(0);
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  }
}

runMigration();
