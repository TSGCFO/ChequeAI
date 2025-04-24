import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "./server/db";

async function main() {
  console.log("Pushing schema to database...");
  
  try {
    // Push schema to database without using migrations
    await migrate(db, { migrationsFolder: "./migrations" });
    console.log("Schema pushed successfully!");
  } catch (error) {
    console.error("Error pushing schema:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();