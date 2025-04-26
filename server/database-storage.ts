import { 
  customers, vendors, chequeTransactions,
  customerDeposits, vendorPayments, aiMessages,
  users, userConversations, telegramUsers,
  type Customer, type Vendor, type ChequeTransaction, 
  type CustomerDeposit, type VendorPayment, type AIMessage,
  type User, type UserConversation, type TelegramUser,
  type InsertCustomer, type InsertVendor, type InsertTransaction, 
  type InsertCustomerDeposit, type InsertVendorPayment, type InsertAIMessage,
  type InsertUser, type InsertUserConversation, type UpdateUser, type InsertTelegramUser,
  type TransactionWithDetails, type BusinessSummary
} from "@shared/schema";

import { db } from "./db";
import { pool } from "./db";
import { eq, and, desc, sql, count, sum } from "drizzle-orm";
import { IStorage } from "./storage";
import session from "express-session";
import connectPg from "connect-pg-simple";

export class DatabaseStorage implements IStorage {
  // Initialize session store using PostgreSQL
  sessionStore: session.Store;
  
  constructor() {
    const PostgresStore = connectPg(session);
    this.sessionStore = new PostgresStore({
      pool,
      tableName: 'session', // Default table name
      createTableIfMissing: true // Automatically create the sessions table if it doesn't exist
    });
  }
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
    try {
      // Due to TypeScript errors with ORM, we'll use direct SQL for all queries
      // This is a cleaner approach and avoids potential SQL syntax issues
      const { pool } = await import('./db');
      
      // Get transaction count
      const transactionCountSQL = "SELECT COUNT(*) FROM cheque_transactions";
      const transactionCountResult = await pool.query(transactionCountSQL);
      const totalTransactions = parseInt(transactionCountResult.rows[0].count) || 0;
      
      // Get total amount
      const totalAmountSQL = "SELECT SUM(cheque_amount) FROM cheque_transactions";
      const totalAmountResult = await pool.query(totalAmountSQL);
      const totalAmount = totalAmountResult.rows[0].sum 
        ? parseFloat(totalAmountResult.rows[0].sum).toFixed(2) 
        : "0.00";
        
      // Get total profit
      const totalProfitSQL = "SELECT SUM(profit) FROM cheque_transactions";
      const totalProfitResult = await pool.query(totalProfitSQL);
      const totalProfit = totalProfitResult.rows[0].sum 
        ? parseFloat(totalProfitResult.rows[0].sum).toFixed(2) 
        : "0.00";
      
      // Get outstanding balance (all transactions where received_from_vendor < amount_to_receive_from_vendor)
      const outstandingBalanceSQL = "SELECT SUM(amount_to_receive_from_vendor - received_from_vendor) FROM cheque_transactions WHERE amount_to_receive_from_vendor > received_from_vendor";
      const outstandingBalanceSQLResult = await pool.query(outstandingBalanceSQL);
      const outstandingBalance = outstandingBalanceSQLResult.rows[0].sum 
        ? parseFloat(outstandingBalanceSQLResult.rows[0].sum).toFixed(2) 
        : "0.00";
  
      // Get pending transactions (where received_from_vendor < amount_to_receive_from_vendor)
      const pendingCountSQL = "SELECT COUNT(*) FROM cheque_transactions WHERE amount_to_receive_from_vendor > received_from_vendor";
      const pendingCountResult = await pool.query(pendingCountSQL);
      const pendingTransactions = parseInt(pendingCountResult.rows[0].count) || 0;
  
      // Get completed transactions (where received_from_vendor >= amount_to_receive_from_vendor)
      const completedCountSQL = "SELECT COUNT(*) FROM cheque_transactions WHERE amount_to_receive_from_vendor <= received_from_vendor";
      const completedCountResult = await pool.query(completedCountSQL);
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
      console.error("Error in getBusinessSummary:", error);
      
      // Return default values if there's an error to prevent app crashes
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
      // Get the conversation history with the max number of messages (for context window)
      const MAX_HISTORY = 35; // Increased from 10 to 35 as per requirements
      
      const messages = await db
        .select()
        .from(aiMessages)
        .where(eq(aiMessages.conversation_id, conversationId))
        .orderBy(aiMessages.created_at);
      
      // Return the most recent MAX_HISTORY messages or all if less than MAX_HISTORY
      return messages.slice(-MAX_HISTORY);
    } catch (error) {
      console.error("Error retrieving AI conversation history:", error);
      return []; // Return empty array instead of throwing to prevent app crashes
    }
  }

  // User management methods
  async getUsers(): Promise<User[]> {
    try {
      return await db.select().from(users);
    } catch (error) {
      console.error("Error retrieving users:", error);
      return [];
    }
  }

  async getUser(id: number): Promise<User | undefined> {
    try {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.user_id, id));
      
      return user;
    } catch (error) {
      console.error(`Error retrieving user with ID ${id}:`, error);
      return undefined;
    }
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    try {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.username, username));
      
      return user;
    } catch (error) {
      console.error(`Error retrieving user with username ${username}:`, error);
      return undefined;
    }
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    try {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, email));
      
      return user;
    } catch (error) {
      console.error(`Error retrieving user with email ${email}:`, error);
      return undefined;
    }
  }

  async createUser(user: InsertUser): Promise<User> {
    try {
      const [result] = await db
        .insert(users)
        .values(user)
        .returning();
      
      return result;
    } catch (error) {
      console.error("Error creating user:", error);
      throw error;
    }
  }

  async updateUser(id: number, userData: Partial<UpdateUser>): Promise<User | undefined> {
    try {
      const [result] = await db
        .update(users)
        .set({
          ...userData,
          updated_at: new Date()
        })
        .where(eq(users.user_id, id))
        .returning();
      
      return result;
    } catch (error) {
      console.error(`Error updating user with ID ${id}:`, error);
      return undefined;
    }
  }

  async deleteUser(id: number): Promise<boolean> {
    try {
      // First delete associated user conversations
      await db
        .delete(userConversations)
        .where(eq(userConversations.user_id, id));
        
      // Then delete the user
      const result = await db
        .delete(users)
        .where(eq(users.user_id, id))
        .returning();
      
      return result.length > 0;
    } catch (error) {
      console.error(`Error deleting user with ID ${id}:`, error);
      return false;
    }
  }

  // User conversation methods
  async getUserConversations(userId: number): Promise<UserConversation[]> {
    try {
      return await db
        .select()
        .from(userConversations)
        .where(eq(userConversations.user_id, userId))
        .orderBy(desc(userConversations.updated_at));
    } catch (error) {
      console.error(`Error retrieving conversations for user ${userId}:`, error);
      return [];
    }
  }

  async getUserConversation(id: number): Promise<UserConversation | undefined> {
    try {
      const [conversation] = await db
        .select()
        .from(userConversations)
        .where(eq(userConversations.conversation_id, id));
      
      return conversation;
    } catch (error) {
      console.error(`Error retrieving conversation with ID ${id}:`, error);
      return undefined;
    }
  }

  async createUserConversation(conversation: InsertUserConversation): Promise<UserConversation> {
    try {
      const [result] = await db
        .insert(userConversations)
        .values(conversation)
        .returning();
      
      return result;
    } catch (error) {
      console.error("Error creating user conversation:", error);
      throw error;
    }
  }

  async updateUserConversation(id: number, conversationData: Partial<InsertUserConversation>): Promise<UserConversation | undefined> {
    try {
      const [result] = await db
        .update(userConversations)
        .set({
          ...conversationData,
          updated_at: new Date()
        })
        .where(eq(userConversations.conversation_id, id))
        .returning();
      
      return result;
    } catch (error) {
      console.error(`Error updating conversation with ID ${id}:`, error);
      return undefined;
    }
  }

  async deleteUserConversation(id: number): Promise<boolean> {
    try {
      const result = await db
        .delete(userConversations)
        .where(eq(userConversations.conversation_id, id))
        .returning();
      
      return result.length > 0;
    } catch (error) {
      console.error(`Error deleting conversation with ID ${id}:`, error);
      return false;
    }
  }

  // Telegram user methods
  async getTelegramUserByChatId(chatId: string): Promise<TelegramUser | undefined> {
    try {
      const [telegramUser] = await db
        .select()
        .from(telegramUsers)
        .where(eq(telegramUsers.chat_id, chatId));
      
      return telegramUser;
    } catch (error) {
      console.error("Error getting Telegram user:", error);
      return undefined;
    }
  }
  
  async createTelegramUser(telegramUser: InsertTelegramUser): Promise<TelegramUser> {
    try {
      const [result] = await db
        .insert(telegramUsers)
        .values(telegramUser)
        .returning();
      
      return result;
    } catch (error) {
      console.error("Error creating Telegram user:", error);
      throw error;
    }
  }
  
  async deleteTelegramUser(chatId: string): Promise<boolean> {
    try {
      const result = await db
        .delete(telegramUsers)
        .where(eq(telegramUsers.chat_id, chatId))
        .returning();
      
      return result.length > 0;
    } catch (error) {
      console.error("Error deleting Telegram user:", error);
      return false;
    }
  }
  
  async updateTelegramUserLastActive(chatId: string): Promise<TelegramUser | undefined> {
    try {
      const [result] = await db
        .update(telegramUsers)
        .set({ last_active: new Date() })
        .where(eq(telegramUsers.chat_id, chatId))
        .returning();
      
      return result;
    } catch (error) {
      console.error("Error updating Telegram user last active:", error);
      return undefined;
    }
  }
}