import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import { neonConfig } from '@neondatabase/serverless';

neonConfig.webSocketConstructor = ws;

async function inspectDatabase() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must be set");
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    // Get all tables
    const tableQuery = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    console.log("Tables in database:");
    tableQuery.rows.forEach((row) => {
      console.log(`- ${row.table_name}`);
    });
    
    // For each table, get column information
    for (const row of tableQuery.rows) {
      const tableName = row.table_name;
      const columnQuery = await pool.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position
      `, [tableName]);
      
      console.log(`\nTable: ${tableName}`);
      console.log("Columns:");
      columnQuery.rows.forEach((col) => {
        console.log(`  - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'YES' ? '(nullable)' : '(not null)'} ${col.column_default ? `(default: ${col.column_default})` : ''}`);
      });
      
      // Get foreign keys
      const fkQuery = await pool.query(`
        SELECT
          tc.constraint_name,
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_name = $1
      `, [tableName]);
      
      if (fkQuery.rows.length > 0) {
        console.log("  Foreign Keys:");
        fkQuery.rows.forEach((fk) => {
          console.log(`    - ${fk.column_name} -> ${fk.foreign_table_name}.${fk.foreign_column_name}`);
        });
      }
    }
  } catch (error) {
    console.error("Error inspecting database:", error);
  } finally {
    await pool.end();
  }
}

inspectDatabase()
  .then(() => console.log("\nDatabase inspection complete"))
  .catch(console.error);