import { Express, Request, Response } from "express";
import { pool } from "./db";
import { requireAuth } from "./auth";

/**
 * Register all report routes
 * @param app Express application
 * @param apiRouter API router prefix
 */
export function registerReportRoutes(app: Express, apiRouter: string): void {
  // Get all database tables and views
  app.get(`${apiRouter}/report/schema`, requireAuth, async (req: Request, res: Response) => {
    try {
      // Query to get all tables and views from the PostgreSQL schema
      const query = `
        SELECT 
          table_name,
          table_type,
          table_schema
        FROM 
          information_schema.tables 
        WHERE 
          table_schema NOT IN ('pg_catalog', 'information_schema') 
          AND table_schema NOT LIKE 'pg_toast%'
          AND table_schema NOT LIKE 'pg_temp%'
        ORDER BY 
          table_schema, table_type, table_name
      `;
      
      const result = await pool.query(query);
      res.json(result.rows);
    } catch (error) {
      console.error("Error fetching database schema:", error);
      res.status(500).json({ message: "Error fetching database schema" });
    }
  });

  // Get data from a specific table or view
  app.get(`${apiRouter}/report/data/:tableName`, requireAuth, async (req: Request, res: Response) => {
    try {
      const { tableName } = req.params;
      const { limit = 100, offset = 0 } = req.query;
      
      // Validate table name to prevent SQL injection
      // Only allow alphanumeric characters, underscores and dots for schema.table format
      if (!/^[a-zA-Z0-9_.]+$/.test(tableName)) {
        return res.status(400).json({ message: "Invalid table name" });
      }
      
      // Get total count
      const countQuery = `SELECT COUNT(*) FROM ${tableName}`;
      const countResult = await pool.query(countQuery);
      const totalCount = parseInt(countResult.rows[0].count);
      
      // Get column information
      const columnsQuery = `
        SELECT 
          column_name, 
          data_type,
          is_nullable
        FROM 
          information_schema.columns
        WHERE 
          table_name = $1
          AND table_schema NOT IN ('pg_catalog', 'information_schema')
        ORDER BY 
          ordinal_position
      `;
      
      const columnsResult = await pool.query(columnsQuery, [tableName.split('.').pop()]);
      
      // Get the actual data with pagination
      const dataQuery = `SELECT * FROM ${tableName} LIMIT $1 OFFSET $2`;
      const dataResult = await pool.query(dataQuery, [limit, offset]);
      
      res.json({
        columns: columnsResult.rows,
        data: dataResult.rows,
        totalCount,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      });
    } catch (error) {
      console.error(`Error fetching data from ${req.params.tableName}:`, error);
      res.status(500).json({ message: `Error fetching data from ${req.params.tableName}` });
    }
  });
}