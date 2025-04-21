import { 
  customers, vendors, chequeTransactions,
  customerDeposits, vendorPayments, aiMessages,
  type Customer, type Vendor, type ChequeTransaction, 
  type CustomerDeposit, type VendorPayment, type AIMessage,
  type InsertCustomer, type InsertVendor, type InsertTransaction, 
  type InsertCustomerDeposit, type InsertVendorPayment, type InsertAIMessage,
  type TransactionWithDetails, type BusinessSummary
} from "@shared/schema";

import { db } from "./db";
import { eq, and, desc, sql, count, sum } from "drizzle-orm";
import { IStorage } from "./storage";

export class DatabaseStorage implements IStorage {
  // Transaction methods
  async getTransactions(options?: {
    limit?: number;
    offset?: number;
    customerId?: number;
    vendorId?: string;
    status?: string;
  }): Promise<ChequeTransaction[]> {
    try {
      let baseQuery = db.select().from(chequeTransactions);
      
      // Apply filters individually instead of using and()
      if (options?.customerId) {
        baseQuery = baseQuery.where(eq(chequeTransactions.customer_id, options.customerId));
      }

      if (options?.vendorId) {
        baseQuery = baseQuery.where(eq(chequeTransactions.vendor_id, options.vendorId));
      }

      if (options?.status) {
        baseQuery = baseQuery.where(eq(chequeTransactions.status, options.status));
      }

      // Apply pagination
      if (options?.limit) {
        baseQuery = baseQuery.limit(options.limit);
      }

      if (options?.offset) {
        baseQuery = baseQuery.offset(options.offset || 0);
      }

      // Order by latest first
      baseQuery = baseQuery.orderBy(desc(chequeTransactions.date));

      return await baseQuery;
    } catch (error) {
      console.error("Error fetching transactions:", error);
      return [];
    }
  }

  async getTransaction(id: number): Promise<ChequeTransaction | undefined> {
    const [transaction] = await db
      .select()
      .from(chequeTransactions)
      .where(eq(chequeTransactions.transaction_id, id));
    
    return transaction;
  }

  async getTransactionWithDetails(id: number): Promise<TransactionWithDetails | undefined> {
    const result = await db
      .select({
        ...chequeTransactions,
        customer: {
          customer_name: customers.customer_name
        },
        vendor: {
          vendor_name: vendors.vendor_name
        }
      })
      .from(chequeTransactions)
      .leftJoin(customers, eq(chequeTransactions.customer_id, customers.customer_id))
      .leftJoin(vendors, eq(chequeTransactions.vendor_id, vendors.vendor_id))
      .where(eq(chequeTransactions.transaction_id, id));
    
    if (result.length === 0) return undefined;
    return result[0] as unknown as TransactionWithDetails;
  }

  async createTransaction(transaction: InsertTransaction): Promise<ChequeTransaction> {
    const [result] = await db
      .insert(chequeTransactions)
      .values(transaction)
      .returning();
    
    return result;
  }

  async updateTransaction(id: number, transaction: Partial<InsertTransaction>): Promise<ChequeTransaction | undefined> {
    const [result] = await db
      .update(chequeTransactions)
      .set(transaction)
      .where(eq(chequeTransactions.transaction_id, id))
      .returning();
    
    return result;
  }

  async deleteTransaction(id: number): Promise<boolean> {
    const result = await db
      .delete(chequeTransactions)
      .where(eq(chequeTransactions.transaction_id, id))
      .returning();
    
    return result.length > 0;
  }

  // Customer methods
  async getCustomers(): Promise<Customer[]> {
    return await db.select().from(customers);
  }

  async getCustomer(id: number): Promise<Customer | undefined> {
    const [customer] = await db
      .select()
      .from(customers)
      .where(eq(customers.customer_id, id));
    
    return customer;
  }

  async createCustomer(customer: InsertCustomer): Promise<Customer> {
    const [result] = await db
      .insert(customers)
      .values(customer)
      .returning();
    
    return result;
  }

  async updateCustomer(id: number, customer: Partial<InsertCustomer>): Promise<Customer | undefined> {
    const [result] = await db
      .update(customers)
      .set(customer)
      .where(eq(customers.customer_id, id))
      .returning();
    
    return result;
  }

  async deleteCustomer(id: number): Promise<boolean> {
    const result = await db
      .delete(customers)
      .where(eq(customers.customer_id, id))
      .returning();
    
    return result.length > 0;
  }

  // Vendor methods
  async getVendors(): Promise<Vendor[]> {
    return await db.select().from(vendors);
  }

  async getVendor(id: string): Promise<Vendor | undefined> {
    const [vendor] = await db
      .select()
      .from(vendors)
      .where(eq(vendors.vendor_id, id));
    
    return vendor;
  }

  async createVendor(vendor: InsertVendor): Promise<Vendor> {
    const [result] = await db
      .insert(vendors)
      .values(vendor)
      .returning();
    
    return result;
  }

  async updateVendor(id: string, vendor: Partial<InsertVendor>): Promise<Vendor | undefined> {
    const [result] = await db
      .update(vendors)
      .set(vendor)
      .where(eq(vendors.vendor_id, id))
      .returning();
    
    return result;
  }

  async deleteVendor(id: string): Promise<boolean> {
    const result = await db
      .delete(vendors)
      .where(eq(vendors.vendor_id, id))
      .returning();
    
    return result.length > 0;
  }

  // Business summary
  async getBusinessSummary(): Promise<BusinessSummary> {
    // Get total transactions count
    const [transactionCount] = await db
      .select({ count: count() })
      .from(chequeTransactions);

    // Get total amount processed
    const [totalAmountResult] = await db
      .select({ sum: sum(chequeTransactions.cheque_amount) })
      .from(chequeTransactions);

    // Get total profit
    const [totalProfitResult] = await db
      .select({ sum: sum(chequeTransactions.profit) })
      .from(chequeTransactions);

    // Get outstanding balance (transactions marked as pending)
    const [outstandingBalanceResult] = await db
      .select({ sum: sum(chequeTransactions.cheque_amount) })
      .from(chequeTransactions)
      .where(eq(chequeTransactions.status, 'pending'));

    // Get pending and completed transaction counts
    const [pendingCount] = await db
      .select({ count: count() })
      .from(chequeTransactions)
      .where(eq(chequeTransactions.status, 'pending'));

    const [completedCount] = await db
      .select({ count: count() })
      .from(chequeTransactions)
      .where(eq(chequeTransactions.status, 'completed'));

    // Format currency values
    const totalAmount = totalAmountResult.sum ? parseFloat(totalAmountResult.sum.toString()).toFixed(2) : "0.00";
    const totalProfit = totalProfitResult.sum ? parseFloat(totalProfitResult.sum.toString()).toFixed(2) : "0.00";
    const outstandingBalance = outstandingBalanceResult.sum 
      ? parseFloat(outstandingBalanceResult.sum.toString()).toFixed(2) 
      : "0.00";

    return {
      totalTransactions: transactionCount.count,
      totalAmount,
      totalProfit,
      outstandingBalance,
      pendingTransactions: pendingCount.count,
      completedTransactions: completedCount.count
    };
  }

  // Reports methods
  async getReportData(
    reportName: string, 
    filters?: { customerId?: number; vendorId?: string; startDate?: string; endDate?: string }
  ): Promise<any[]> {
    try {
      const { pool } = await import('./db');
      
      let query = `SELECT * FROM ${reportName}`;
      const queryParams: any[] = [];
      
      // Apply filters if provided
      if (filters) {
        const whereConditions: string[] = [];
        
        if (filters.customerId) {
          whereConditions.push(`customer_id = $${queryParams.length + 1}`);
          queryParams.push(filters.customerId);
        }
        
        if (filters.vendorId) {
          whereConditions.push(`vendor_id = $${queryParams.length + 1}`);
          queryParams.push(filters.vendorId);
        }
        
        if (filters.startDate) {
          whereConditions.push(`date >= $${queryParams.length + 1}`);
          queryParams.push(filters.startDate);
        }
        
        if (filters.endDate) {
          whereConditions.push(`date <= $${queryParams.length + 1}`);
          queryParams.push(filters.endDate);
        }
        
        if (whereConditions.length > 0) {
          query += ` WHERE ${whereConditions.join(' AND ')}`;
        }
      }
      
      const result = await pool.query(query, queryParams);
      return result.rows;
    } catch (error) {
      console.error(`Error retrieving report data from ${reportName}:`, error);
      return []; // Return empty array instead of throwing to prevent app crashes
    }
  }

  // Customer Deposits methods
  async createCustomerDeposit(deposit: InsertCustomerDeposit): Promise<CustomerDeposit> {
    try {
      // Verify customer exists
      const customer = await this.getCustomer(deposit.customer_id);
      if (!customer) {
        throw new Error("Customer not found");
      }
      
      // Insert the deposit - only include customer_id and amount as specified
      const [result] = await db
        .insert(customerDeposits)
        .values({
          customer_id: deposit.customer_id,
          amount: deposit.amount
        })
        .returning();
      
      return result;
    } catch (error) {
      console.error("Error creating customer deposit:", error);
      throw error;
    }
  }

  // AI Assistant methods
  async saveAIMessage(message: InsertAIMessage): Promise<AIMessage> {
    const [result] = await db
      .insert(aiMessages)
      .values(message)
      .returning();
    
    return result;
  }

  async getAIConversationHistory(conversationId: string): Promise<AIMessage[]> {
    try {
      // Fix the query to use the correct column name for timestamp
      return await db
        .select()
        .from(aiMessages)
        .where(eq(aiMessages.conversation_id, conversationId))
        .orderBy(aiMessages.created_at);
    } catch (error) {
      console.error("Error retrieving AI conversation history:", error);
      return []; // Return empty array instead of throwing to prevent app crashes
    }
  }
}