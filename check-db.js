const { Pool } = require('pg');

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set");
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    // Check connection
    const result = await pool.query('SELECT NOW()');
    console.log("Database connection successful!");
    console.log("Current time:", result.rows[0].now);
    
    // List all tables
    console.log("\nListing all tables:");
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    if (tables.rows.length === 0) {
      console.log("No tables found. Schema needs to be pushed.");
    } else {
      tables.rows.forEach(row => {
        console.log(`- ${row.table_name}`);
      });
    }
    
    // List enum types if any
    try {
      console.log("\nListing enum types:");
      const enums = await pool.query(`
        SELECT pg_type.typname, pg_enum.enumlabel
        FROM pg_type 
        JOIN pg_enum ON pg_enum.enumtypid = pg_type.oid
        ORDER BY pg_type.typname, pg_enum.enumsortorder
      `);
      
      if (enums.rows.length === 0) {
        console.log("No enum types found.");
      } else {
        const enumMap = {};
        enums.rows.forEach(row => {
          if (!enumMap[row.typname]) {
            enumMap[row.typname] = [];
          }
          enumMap[row.typname].push(row.enumlabel);
        });
        
        Object.entries(enumMap).forEach(([name, values]) => {
          console.log(`- ${name}: ${values.join(', ')}`);
        });
      }
    } catch (error) {
      console.error("Error listing enum types:", error.message);
    }
    
  } catch (error) {
    console.error("Database error:", error.message);
  } finally {
    await pool.end();
  }
}

main();