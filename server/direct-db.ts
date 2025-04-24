/**
 * This file provides direct database connection functionality
 * using regular PostgreSQL client rather than ORM
 */
import pkg from 'pg';
const { Pool } = pkg;

// Use Supabase database
const databaseUrl = process.env.SUPABASE_DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "SUPABASE_DATABASE_URL must be set. Please provide a valid Supabase connection string.",
  );
}

console.log("Connecting to database using node-postgres directly...");
export const pool = new Pool({ 
  connectionString: databaseUrl,
  ssl: {
    rejectUnauthorized: false // Required for Supabase connection
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
    // First try to get from business_summary view if it exists
    try {
      const summaryResult = await pool.query('SELECT * FROM business_summary LIMIT 1');
      if (summaryResult.rows && summaryResult.rows.length > 0) {
        const summary = summaryResult.rows[0];
        return {
          totalTransactions: parseInt(summary.total_transactions) || 0,
          totalAmount: summary.total_cheque_amount ? parseFloat(summary.total_cheque_amount).toFixed(2) : "0.00",
          totalProfit: summary.total_potential_profit ? parseFloat(summary.total_potential_profit).toFixed(2) : "0.00",
          outstandingBalance: summary.total_outstanding_to_customers ? parseFloat(summary.total_outstanding_to_customers).toFixed(2) : "0.00",
          pendingTransactions: 0, // Not available in the view
          completedTransactions: 0 // Not available in the view
        };
      }
    } catch (viewError) {
      console.log("Could not get business summary from view, calculating manually");
    }

    // Get total transactions
    const transactionCountResult = await pool.query('SELECT COUNT(*) FROM cheque_transactions');
    const totalTransactions = parseInt(transactionCountResult.rows[0].count) || 0;

    // Get total amount
    const totalAmountResult = await pool.query('SELECT SUM(cheque_amount) FROM cheque_transactions');
    const totalAmount = totalAmountResult.rows[0].sum ? parseFloat(totalAmountResult.rows[0].sum).toFixed(2) : "0.00";

    // Get total profit
    const totalProfitResult = await pool.query('SELECT SUM(profit) FROM cheque_transactions');
    const totalProfit = totalProfitResult.rows[0].sum ? parseFloat(totalProfitResult.rows[0].sum).toFixed(2) : "0.00";

    // Get outstanding balance (using net_payable_to_customer - paid_to_customer)
    const outstandingBalanceResult = await pool.query(
      "SELECT SUM(net_payable_to_customer - COALESCE(paid_to_customer, 0)) FROM cheque_transactions"
    );
    const outstandingBalance = outstandingBalanceResult.rows[0].sum 
      ? parseFloat(outstandingBalanceResult.rows[0].sum).toFixed(2)
      : "0.00";

    // Since there's no status column, we'll calculate based on payment status
    // Try first using the status column if it exists
    try {
      // Get "pending" transaction count (using status column)
      const pendingStatusCountResult = await pool.query(
        "SELECT COUNT(*) FROM cheque_transactions WHERE status = $1", ['pending']
      );
      const pendingTransactions = parseInt(pendingStatusCountResult.rows[0].count) || 0;

      // Get "completed" transaction count (using status column)
      const completedStatusCountResult = await pool.query(
        "SELECT COUNT(*) FROM cheque_transactions WHERE status = $1", ['completed']
      );
      const completedTransactions = parseInt(completedStatusCountResult.rows[0].count) || 0;

      return {
        totalTransactions,
        totalAmount,
        totalProfit,
        outstandingBalance,
        pendingTransactions,
        completedTransactions
      };
    } catch (statusError) {
      console.log("Status column not available, using payment status", statusError);
    }

    // Fallback: Get "pending" transaction count (not fully paid to customer)
    const pendingCountResult = await pool.query(
      "SELECT COUNT(*) FROM cheque_transactions WHERE net_payable_to_customer > COALESCE(paid_to_customer, 0)"
    );
    const pendingTransactions = parseInt(pendingCountResult.rows[0].count) || 0;

    // Get "completed" transaction count (fully paid to customer)
    const completedCountResult = await pool.query(
      "SELECT COUNT(*) FROM cheque_transactions WHERE net_payable_to_customer <= COALESCE(paid_to_customer, 0)"
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