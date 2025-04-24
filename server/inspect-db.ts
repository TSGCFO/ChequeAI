/**
 * This script inspects the database schema to help us understand the structure
 */
import { pool } from './direct-db';

async function inspectDatabase() {
  try {
    console.log("Inspecting database schema...");

    // List all tables in the database
    const tablesQuery = `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `;
    
    const tablesResult = await pool.query(tablesQuery);
    console.log("Tables in the database:");
    tablesResult.rows.forEach((row, index) => {
      console.log(`${index + 1}. ${row.table_name}`);
    });
    console.log();

    // For each table, list its columns
    for (const tableRow of tablesResult.rows) {
      const tableName = tableRow.table_name;
      
      const columnsQuery = `
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position;
      `;
      
      const columnsResult = await pool.query(columnsQuery, [tableName]);
      console.log(`Table: ${tableName}`);
      console.log("Columns:");
      columnsResult.rows.forEach(col => {
        console.log(`  - ${col.column_name} (${col.data_type}, ${col.is_nullable === 'YES' ? 'nullable' : 'not nullable'})`);
      });
      
      // Get primary key information
      const pkQuery = `
        SELECT a.attname as column_name
        FROM pg_index i
        JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
        WHERE i.indrelid = $1::regclass AND i.indisprimary;
      `;
      
      const pkResult = await pool.query(pkQuery, [`public.${tableName}`]);
      if (pkResult.rows.length > 0) {
        console.log("Primary key:", pkResult.rows.map(row => row.column_name).join(', '));
      } else {
        console.log("No primary key defined");
      }
      
      console.log();
    }

    console.log("Database inspection complete");
  } catch (error) {
    console.error("Error inspecting database:", error);
  } finally {
    // Close the connection pool
    await pool.end();
  }
}

// Execute the inspection
inspectDatabase();