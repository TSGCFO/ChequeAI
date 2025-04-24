import { db, pool } from './db';
import { sql } from 'drizzle-orm';

async function main() {
  console.log("Inspecting database schema...");
  
  try {
    // Check PostgreSQL version
    const versionResult = await db.execute(sql`SELECT version()`);
    console.log("PostgreSQL Version:", versionResult.rows[0].version);
    
    // List all tables in the public schema
    const tablesResult = await db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    console.log("\nTables in the database:");
    tablesResult.rows.forEach((row: any) => {
      console.log(`- ${row.table_name}`);
    });
    
    // List all enums in the database
    const enumsResult = await db.execute(sql`
      SELECT pg_type.typname, pg_enum.enumlabel
      FROM pg_type 
      JOIN pg_enum ON pg_enum.enumtypid = pg_type.oid
      ORDER BY pg_type.typname, pg_enum.enumsortorder
    `);
    
    // Group enum values by enum name
    const enums = enumsResult.rows.reduce((acc: any, row: any) => {
      if (!acc[row.typname]) {
        acc[row.typname] = [];
      }
      acc[row.typname].push(row.enumlabel);
      return acc;
    }, {});
    
    console.log("\nEnums in the database:");
    Object.entries(enums).forEach(([name, values]) => {
      console.log(`- ${name}: ${(values as string[]).join(', ')}`);
    });
    
    // Count rows in each table
    console.log("\nRow counts in each table:");
    for (const row of tablesResult.rows) {
      const tableName = row.table_name;
      if (tableName === 'session') continue; // Skip session table
      
      const countResult = await db.execute(sql`
        SELECT COUNT(*) as count FROM ${sql.identifier(tableName)}
      `);
      console.log(`- ${tableName}: ${countResult.rows[0].count} rows`);
    }
    
  } catch (error) {
    console.error("Error inspecting database:", error);
  } finally {
    await pool.end();
  }
}

main();