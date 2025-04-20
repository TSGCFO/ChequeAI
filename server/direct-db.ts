/**
 * This file provides direct database connection functionality
 * using regular PostgreSQL client rather than ORM
 */
import pkg from 'pg';
const { Pool } = pkg;

// Priority: Use Supabase URL if available, otherwise fall back to Replit's DATABASE_URL
const databaseUrl = process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "No database connection string available. Please set SUPABASE_DATABASE_URL or DATABASE_URL.",
  );
}

console.log("Connecting to database using node-postgres directly...");
export const pool = new Pool({ 
  connectionString: databaseUrl,
  ssl: {
    rejectUnauthorized: false // This is only for development, not recommended for production
  }
});

// Test database connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Database connection error:', err.message);
  } else {
    console.log('Database connection successful! Current time:', res.rows[0].now);
  }
});

/**
 * Get all customers from the database
 */
export async function getCustomers() {
  try {
    const result = await pool.query('SELECT * FROM customers');
    return result.rows;
  } catch (error) {
    console.error('Error fetching customers:', error);
    return [];
  }
}

/**
 * Get all vendors from the database
 */
export async function getVendors() {
  try {
    const result = await pool.query('SELECT * FROM vendors');
    return result.rows;
  } catch (error) {
    console.error('Error fetching vendors:', error);
    return [];
  }
}

/**
 * Get all transactions from the database
 */
export async function getTransactions() {
  try {
    const result = await pool.query('SELECT * FROM cheque_transactions ORDER BY date DESC');
    return result.rows;
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return [];
  }
}

/**
 * Get business summary from the database
 */
export async function getBusinessSummary() {
  try {
    // Get total transactions
    const transactionCountResult = await pool.query('SELECT COUNT(*) FROM cheque_transactions');
    const totalTransactions = parseInt(transactionCountResult.rows[0].count) || 0;

    // Get total amount
    const totalAmountResult = await pool.query('SELECT SUM(cheque_amount) FROM cheque_transactions');
    const totalAmount = totalAmountResult.rows[0].sum ? parseFloat(totalAmountResult.rows[0].sum).toFixed(2) : "0.00";

    // Get total profit
    const totalProfitResult = await pool.query('SELECT SUM(profit) FROM cheque_transactions');
    const totalProfit = totalProfitResult.rows[0].sum ? parseFloat(totalProfitResult.rows[0].sum).toFixed(2) : "0.00";

    // Get outstanding balance (pending transactions)
    const outstandingBalanceResult = await pool.query(
      "SELECT SUM(cheque_amount) FROM cheque_transactions WHERE status = 'pending'"
    );
    const outstandingBalance = outstandingBalanceResult.rows[0].sum 
      ? parseFloat(outstandingBalanceResult.rows[0].sum).toFixed(2)
      : "0.00";

    // Get pending transaction count
    const pendingCountResult = await pool.query(
      "SELECT COUNT(*) FROM cheque_transactions WHERE status = 'pending'"
    );
    const pendingTransactions = parseInt(pendingCountResult.rows[0].count) || 0;

    // Get completed transaction count
    const completedCountResult = await pool.query(
      "SELECT COUNT(*) FROM cheque_transactions WHERE status = 'completed'"
    );
    const completedTransactions = parseInt(completedCountResult.rows[0].count) || 0;

    return {
      totalTransactions,
      totalAmount,
      totalProfit,
      outstandingBalance,
      pendingTransactions,
      completedTransactions
    };
  } catch (error) {
    console.error('Error getting business summary:', error);
    return {
      totalTransactions: 0,
      totalAmount: "0.00",
      totalProfit: "0.00",
      outstandingBalance: "0.00",
      pendingTransactions: 0,
      completedTransactions: 0
    };
  }
}