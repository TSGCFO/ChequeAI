import {
  type Customer,
  type InsertCustomer,
  type Vendor,
  type InsertVendor,
  type ChequeTransaction,
  type InsertTransaction,
  type BusinessSummary,
  type TransactionWithDetails,
  type AIMessage,
  type InsertAIMessage,
  type CustomerDeposit,
  type InsertCustomerDeposit,
  type User,
  type InsertUser,
  type UpdateUser,
  type UserConversation,
  type InsertUserConversation
} from "@shared/schema";

export interface IStorage {
  // Transaction methods
  getTransactions(options?: {
    limit?: number;
    offset?: number;
    customerId?: number;
    vendorId?: string;
    status?: string;
  }): Promise<ChequeTransaction[]>;
  getTransaction(id: number): Promise<ChequeTransaction | undefined>;
  getTransactionWithDetails(id: number): Promise<TransactionWithDetails | undefined>;
  createTransaction(transaction: InsertTransaction): Promise<ChequeTransaction>;
  updateTransaction(id: number, transaction: Partial<InsertTransaction>): Promise<ChequeTransaction | undefined>;
  deleteTransaction(id: number): Promise<boolean>;
  
  // Customer methods
  getCustomers(): Promise<Customer[]>;
  getCustomer(id: number): Promise<Customer | undefined>;
  createCustomer(customer: InsertCustomer): Promise<Customer>;
  updateCustomer(id: number, customer: Partial<InsertCustomer>): Promise<Customer | undefined>;
  deleteCustomer(id: number): Promise<boolean>;
  
  // Vendor methods
  getVendors(): Promise<Vendor[]>;
  getVendor(id: string): Promise<Vendor | undefined>;
  createVendor(vendor: InsertVendor): Promise<Vendor>;
  updateVendor(id: string, vendor: Partial<InsertVendor>): Promise<Vendor | undefined>;
  deleteVendor(id: string): Promise<boolean>;
  
  // Customer Deposits methods
  createCustomerDeposit(deposit: InsertCustomerDeposit): Promise<CustomerDeposit>;
  
  // Business summary
  getBusinessSummary(): Promise<BusinessSummary>;
  
  // Reports
  getReportData(
    reportName: string, 
    filters?: { customerId?: number; vendorId?: string; startDate?: string; endDate?: string }
  ): Promise<any[]>;
  
  // AI Assistant methods
  saveAIMessage(message: InsertAIMessage): Promise<AIMessage>;
  getAIConversationHistory(conversationId: string): Promise<AIMessage[]>;
  
  // User methods
  getUsers(): Promise<User[]>;
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, user: Partial<UpdateUser>): Promise<User | undefined>;
  deleteUser(id: number): Promise<boolean>;
  
  // User conversation methods
  getUserConversations(userId: number): Promise<UserConversation[]>;
  getUserConversation(id: number): Promise<UserConversation | undefined>;
  createUserConversation(conversation: InsertUserConversation): Promise<UserConversation>;
  updateUserConversation(id: number, conversation: Partial<InsertUserConversation>): Promise<UserConversation | undefined>;
  deleteUserConversation(id: number): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private transactions: Map<number, ChequeTransaction>;
  private customers: Map<number, Customer>;
  private vendors: Map<string, Vendor>;
  private aiMessages: AIMessage[];
  private users: Map<number, User>;
  private userConversations: Map<number, UserConversation>;
  private nextTransactionId: number;
  private nextCustomerId: number;
  private nextMessageId: number;
  private nextUserId: number;
  private nextConversationId: number;
  
  constructor() {
    this.transactions = new Map();
    this.customers = new Map();
    this.vendors = new Map();
    this.aiMessages = [];
    this.users = new Map();
    this.userConversations = new Map();
    this.nextTransactionId = 1;
    this.nextCustomerId = 1;
    this.nextMessageId = 1;
    this.nextUserId = 1;
    this.nextConversationId = 1;
    
    // Add sample data
    this.initializeSampleData();
  }
  
  private initializeSampleData() {
    // Add default superuser
    const superUser: User = {
      user_id: this.nextUserId++,
      username: "waldo196637",
      password: "$2b$10$X2fgrTLGvvY5MkSh6RPdG.ks1zcnYaQZPOf5V9.4L3cWZ4Z8yJUjq", // Hashed password for "Hassan8488$@"
      email: "hassansadiq73@gmail.com",
      role: "superuser",
      first_name: "Hassan",
      last_name: "Sadiq",
      is_active: true,
      last_login: null,
      created_at: new Date(),
      updated_at: new Date()
    };
    
    this.users.set(superUser.user_id, superUser);
    
    // Add sample customers
    const customer1: Customer = {
      customer_id: this.nextCustomerId++,
      customer_name: "Atlas Construction Co.",
      contact_info: "contact@atlasconstruction.com",
      fee_percentage: "2.00" as any,
      created_at: new Date(),
      updated_at: new Date()
    };
    
    const customer2: Customer = {
      customer_id: this.nextCustomerId++,
      customer_name: "Martinez Landscaping",
      contact_info: "info@martinezlandscaping.com",
      fee_percentage: "3.00" as any,
      created_at: new Date(),
      updated_at: new Date()
    };
    
    this.customers.set(customer1.customer_id, customer1);
    this.customers.set(customer2.customer_id, customer2);
    
    // Add sample vendors
    const vendor1: Vendor = {
      vendor_id: "CTL1",
      vendor_name: "Central Bank Inc.",
      fee_percentage: "1.00" as any,
      contact_info: "support@centralbank.com",
      created_at: new Date(),
      updated_at: new Date()
    };
    
    const vendor2: Vendor = {
      vendor_id: "FNT2",
      vendor_name: "First National",
      fee_percentage: "1.50" as any,
      contact_info: "info@firstnational.com",
      created_at: new Date(),
      updated_at: new Date()
    };
    
    this.vendors.set(vendor1.vendor_id, vendor1);
    this.vendors.set(vendor2.vendor_id, vendor2);
    
    // Add sample transactions
    const transaction1: ChequeTransaction = {
      transaction_id: this.nextTransactionId++,
      date: new Date(),
      customer_id: customer1.customer_id,
      cheque_number: "43672",
      cheque_amount: "4850.00" as any,
      customer_fee: "97.00" as any,
      net_payable_to_customer: "4753.00" as any,
      vendor_id: vendor1.vendor_id,
      vendor_fee: "48.50" as any,
      amount_to_receive_from_vendor: "4801.50" as any,
      profit: "48.50" as any,
      paid_to_customer: "4753.00" as any,
      received_from_vendor: "4801.50" as any,
      profit_withdrawn: "0.00" as any,
      created_at: new Date(),
      updated_at: new Date(),
      status: "completed"
    };
    
    const transaction2: ChequeTransaction = {
      transaction_id: this.nextTransactionId++,
      date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      customer_id: customer2.customer_id,
      cheque_number: "98752",
      cheque_amount: "2340.00" as any,
      customer_fee: "70.20" as any,
      net_payable_to_customer: "2269.80" as any,
      vendor_id: vendor2.vendor_id,
      vendor_fee: "35.10" as any,
      amount_to_receive_from_vendor: "2304.90" as any,
      profit: "35.10" as any,
      paid_to_customer: "0.00" as any,
      received_from_vendor: "0.00" as any,
      profit_withdrawn: "0.00" as any,
      created_at: new Date(),
      updated_at: new Date(),
      status: "pending"
    };
    
    this.transactions.set(transaction1.transaction_id, transaction1);
    this.transactions.set(transaction2.transaction_id, transaction2);
  }

  // Transaction methods
  async getTransactions(options?: {
    limit?: number;
    offset?: number;
    customerId?: number;
    vendorId?: string;
    status?: string;
  }): Promise<ChequeTransaction[]> {
    let transactions = Array.from(this.transactions.values());
    
    // Apply filters
    if (options?.customerId) {
      transactions = transactions.filter(t => t.customer_id === options.customerId);
    }
    
    if (options?.vendorId) {
      transactions = transactions.filter(t => t.vendor_id === options.vendorId);
    }
    
    if (options?.status) {
      transactions = transactions.filter(t => t.status === options.status);
    }
    
    // Sort by date (newest first)
    transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    // Apply pagination
    if (options?.offset) {
      transactions = transactions.slice(options.offset);
    }
    
    if (options?.limit) {
      transactions = transactions.slice(0, options.limit);
    }
    
    return transactions;
  }

  async getTransaction(id: number): Promise<ChequeTransaction | undefined> {
    return this.transactions.get(id);
  }

  async getTransactionWithDetails(id: number): Promise<TransactionWithDetails | undefined> {
    const transaction = this.transactions.get(id);
    
    if (!transaction) {
      return undefined;
    }
    
    const customer = this.customers.get(transaction.customer_id);
    const vendor = this.vendors.get(transaction.vendor_id);
    
    if (!customer || !vendor) {
      return undefined;
    }
    
    return {
      ...transaction,
      customer: {
        customer_name: customer.customer_name
      },
      vendor: {
        vendor_name: vendor.vendor_name
      }
    };
  }

  async createTransaction(transaction: InsertTransaction): Promise<ChequeTransaction> {
    const customer = this.customers.get(transaction.customer_id);
    if (!customer) {
      throw new Error("Customer not found");
    }
    
    const vendor = this.vendors.get(transaction.vendor_id);
    if (!vendor) {
      throw new Error("Vendor not found");
    }
    
    // Calculate fees and profit
    const chequeAmount = parseFloat(transaction.cheque_amount as any);
    const customerFeePercentage = parseFloat(customer.fee_percentage as any);
    const vendorFeePercentage = parseFloat(vendor.fee_percentage as any);
    
    const customerFee = (chequeAmount * customerFeePercentage / 100).toFixed(2);
    const netPayableToCustomer = (chequeAmount - parseFloat(customerFee)).toFixed(2);
    const vendorFee = (chequeAmount * vendorFeePercentage / 100).toFixed(2);
    const amountToReceiveFromVendor = (chequeAmount - parseFloat(vendorFee)).toFixed(2);
    const profit = (parseFloat(customerFee) - parseFloat(vendorFee)).toFixed(2);
    
    const newTransaction: ChequeTransaction = {
      transaction_id: this.nextTransactionId++,
      date: transaction.date || new Date(),
      customer_id: transaction.customer_id,
      cheque_number: transaction.cheque_number,
      cheque_amount: transaction.cheque_amount,
      customer_fee: customerFee as any,
      net_payable_to_customer: netPayableToCustomer as any,
      vendor_id: transaction.vendor_id,
      vendor_fee: vendorFee as any,
      amount_to_receive_from_vendor: amountToReceiveFromVendor as any,
      profit: profit as any,
      paid_to_customer: "0.00" as any,
      received_from_vendor: "0.00" as any,
      profit_withdrawn: "0.00" as any,
      created_at: new Date(),
      updated_at: new Date(),
      status: transaction.status || "pending"
    };
    
    this.transactions.set(newTransaction.transaction_id, newTransaction);
    return newTransaction;
  }

  async updateTransaction(id: number, transaction: Partial<InsertTransaction>): Promise<ChequeTransaction | undefined> {
    const existingTransaction = this.transactions.get(id);
    
    if (!existingTransaction) {
      return undefined;
    }
    
    let updatedTransaction = { ...existingTransaction };
    
    // Update fields
    if (transaction.date) {
      updatedTransaction.date = transaction.date;
    }
    
    if (transaction.customer_id) {
      updatedTransaction.customer_id = transaction.customer_id;
    }
    
    if (transaction.cheque_number) {
      updatedTransaction.cheque_number = transaction.cheque_number;
    }
    
    if (transaction.cheque_amount) {
      updatedTransaction.cheque_amount = transaction.cheque_amount;
    }
    
    if (transaction.vendor_id) {
      updatedTransaction.vendor_id = transaction.vendor_id;
    }
    
    if (transaction.status) {
      updatedTransaction.status = transaction.status;
    }
    
    // Recalculate fees and profit if necessary
    if (transaction.cheque_amount || transaction.customer_id || transaction.vendor_id) {
      const customer = this.customers.get(updatedTransaction.customer_id);
      if (!customer) {
        throw new Error("Customer not found");
      }
      
      const vendor = this.vendors.get(updatedTransaction.vendor_id);
      if (!vendor) {
        throw new Error("Vendor not found");
      }
      
      const chequeAmount = parseFloat(updatedTransaction.cheque_amount as any);
      const customerFeePercentage = parseFloat(customer.fee_percentage as any);
      const vendorFeePercentage = parseFloat(vendor.fee_percentage as any);
      
      const customerFee = (chequeAmount * customerFeePercentage / 100).toFixed(2);
      const netPayableToCustomer = (chequeAmount - parseFloat(customerFee)).toFixed(2);
      const vendorFee = (chequeAmount * vendorFeePercentage / 100).toFixed(2);
      const amountToReceiveFromVendor = (chequeAmount - parseFloat(vendorFee)).toFixed(2);
      const profit = (parseFloat(customerFee) - parseFloat(vendorFee)).toFixed(2);
      
      updatedTransaction.customer_fee = customerFee as any;
      updatedTransaction.net_payable_to_customer = netPayableToCustomer as any;
      updatedTransaction.vendor_fee = vendorFee as any;
      updatedTransaction.amount_to_receive_from_vendor = amountToReceiveFromVendor as any;
      updatedTransaction.profit = profit as any;
    }
    
    updatedTransaction.updated_at = new Date();
    
    this.transactions.set(id, updatedTransaction);
    return updatedTransaction;
  }

  async deleteTransaction(id: number): Promise<boolean> {
    return this.transactions.delete(id);
  }

  // Customer methods
  async getCustomers(): Promise<Customer[]> {
    return Array.from(this.customers.values());
  }

  async getCustomer(id: number): Promise<Customer | undefined> {
    return this.customers.get(id);
  }

  async createCustomer(customer: InsertCustomer): Promise<Customer> {
    const newCustomer: Customer = {
      ...customer,
      customer_id: this.nextCustomerId++,
      created_at: new Date(),
      updated_at: new Date()
    };
    
    this.customers.set(newCustomer.customer_id, newCustomer);
    return newCustomer;
  }

  async updateCustomer(id: number, customer: Partial<InsertCustomer>): Promise<Customer | undefined> {
    const existingCustomer = this.customers.get(id);
    
    if (!existingCustomer) {
      return undefined;
    }
    
    const updatedCustomer: Customer = {
      ...existingCustomer,
      ...customer,
      updated_at: new Date()
    };
    
    this.customers.set(id, updatedCustomer);
    return updatedCustomer;
  }

  async deleteCustomer(id: number): Promise<boolean> {
    // Check if customer has transactions
    const hasTransactions = Array.from(this.transactions.values()).some(
      transaction => transaction.customer_id === id
    );
    
    if (hasTransactions) {
      throw new Error("Cannot delete customer with existing transactions");
    }
    
    return this.customers.delete(id);
  }

  // Vendor methods
  async getVendors(): Promise<Vendor[]> {
    return Array.from(this.vendors.values());
  }

  async getVendor(id: string): Promise<Vendor | undefined> {
    return this.vendors.get(id);
  }

  async createVendor(vendor: InsertVendor): Promise<Vendor> {
    // Generate vendor ID (simplified version of the function in database)
    const prefix = vendor.vendor_name.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, '').padEnd(3, 'X');
    const vendorId = `${prefix}${Math.floor(Math.random() * 1000)}`;
    
    const newVendor: Vendor = {
      ...vendor,
      vendor_id: vendorId,
      created_at: new Date(),
      updated_at: new Date()
    };
    
    this.vendors.set(vendorId, newVendor);
    return newVendor;
  }

  async updateVendor(id: string, vendor: Partial<InsertVendor>): Promise<Vendor | undefined> {
    const existingVendor = this.vendors.get(id);
    
    if (!existingVendor) {
      return undefined;
    }
    
    const updatedVendor: Vendor = {
      ...existingVendor,
      ...vendor,
      vendor_id: id, // Ensure ID doesn't change
      updated_at: new Date()
    };
    
    this.vendors.set(id, updatedVendor);
    return updatedVendor;
  }

  async deleteVendor(id: string): Promise<boolean> {
    // Check if vendor has transactions
    const hasTransactions = Array.from(this.transactions.values()).some(
      transaction => transaction.vendor_id === id
    );
    
    if (hasTransactions) {
      throw new Error("Cannot delete vendor with existing transactions");
    }
    
    return this.vendors.delete(id);
  }
  
  // Customer Deposits
  async createCustomerDeposit(deposit: InsertCustomerDeposit): Promise<CustomerDeposit> {
    const customer = await this.getCustomer(deposit.customer_id);
    if (!customer) {
      throw new Error("Customer not found");
    }
    
    // Only include customer_id and amount as specified
    const newDeposit: CustomerDeposit = {
      deposit_id: 1, // In a real implementation, this would be auto-generated by the database
      customer_id: deposit.customer_id,
      amount: deposit.amount,
      date: new Date(),
      fully_allocated: false,
      notes: null,
      created_at: new Date(),
      updated_at: new Date()
    };
    
    return newDeposit;
  }

  // Business summary
  async getBusinessSummary(): Promise<BusinessSummary> {
    const transactions = Array.from(this.transactions.values());
    
    const totalTransactions = transactions.length;
    const totalAmount = transactions.reduce((sum, t) => sum + parseFloat(t.cheque_amount as any), 0).toFixed(2);
    const totalProfit = transactions.reduce((sum, t) => sum + parseFloat(t.profit as any), 0).toFixed(2);
    
    const pendingTransactions = transactions.filter(t => t.status === "pending").length;
    const completedTransactions = transactions.filter(t => t.status === "completed").length;
    
    // Calculate outstanding balance (net payable - paid to customer)
    const outstandingBalance = transactions
      .reduce((sum, t) => {
        const netPayable = parseFloat(t.net_payable_to_customer as any);
        const paid = parseFloat(t.paid_to_customer as any);
        return sum + (netPayable - paid);
      }, 0)
      .toFixed(2);
    
    return {
      totalTransactions,
      totalAmount,
      totalProfit,
      outstandingBalance,
      pendingTransactions,
      completedTransactions
    };
  }

  // Reports methods
  async getReportData(
    reportName: string, 
    filters?: { customerId?: number; vendorId?: string; startDate?: string; endDate?: string }
  ): Promise<any[]> {
    // This is a simplified implementation for memory storage
    // In a real implementation, we would have proper SQL views
    
    const transactions = Array.from(this.transactions.values());
    const customers = Array.from(this.customers.values());
    const vendors = Array.from(this.vendors.values());
    
    // Apply filters
    let filteredTransactions = [...transactions];
    
    if (filters?.customerId) {
      filteredTransactions = filteredTransactions.filter(t => t.customer_id === filters.customerId);
    }
    
    if (filters?.vendorId) {
      filteredTransactions = filteredTransactions.filter(t => t.vendor_id === filters.vendorId);
    }
    
    if (filters?.startDate) {
      const startDate = new Date(filters.startDate);
      filteredTransactions = filteredTransactions.filter(t => new Date(t.date) >= startDate);
    }
    
    if (filters?.endDate) {
      const endDate = new Date(filters.endDate);
      filteredTransactions = filteredTransactions.filter(t => new Date(t.date) <= endDate);
    }
    
    // Return data based on report name
    switch (reportName) {
      case "customer_balances":
        return customers.map(customer => {
          const customerTransactions = transactions.filter(t => t.customer_id === customer.customer_id);
          const totalOwed = customerTransactions.reduce((sum, t) => sum + parseFloat(t.net_payable_to_customer as any), 0).toFixed(2);
          const totalPaid = customerTransactions.reduce((sum, t) => sum + parseFloat(t.paid_to_customer as any), 0).toFixed(2);
          const balance = (parseFloat(totalOwed) - parseFloat(totalPaid)).toFixed(2);
          
          return {
            customer_id: customer.customer_id,
            customer_name: customer.customer_name,
            total_owed: totalOwed,
            total_paid: totalPaid,
            balance
          };
        });
        
      case "vendor_balances":
        return vendors.map(vendor => {
          const vendorTransactions = transactions.filter(t => t.vendor_id === vendor.vendor_id);
          const totalReceivable = vendorTransactions.reduce((sum, t) => sum + parseFloat(t.amount_to_receive_from_vendor as any), 0).toFixed(2);
          const totalReceived = vendorTransactions.reduce((sum, t) => sum + parseFloat(t.received_from_vendor as any), 0).toFixed(2);
          const balance = (parseFloat(totalReceivable) - parseFloat(totalReceived)).toFixed(2);
          
          return {
            vendor_id: vendor.vendor_id,
            vendor_name: vendor.vendor_name,
            total_receivable: totalReceivable,
            total_received: totalReceived,
            balance
          };
        });
        
      case "daily_profit_summary":
        // Group transactions by date
        const dailyProfits = new Map<string, number>();
        filteredTransactions.forEach(t => {
          const dateStr = new Date(t.date).toISOString().split('T')[0];
          const profit = parseFloat(t.profit as any || "0");
          dailyProfits.set(dateStr, (dailyProfits.get(dateStr) || 0) + profit);
        });
        
        return Array.from(dailyProfits.entries()).map(([date, profit]) => ({
          date,
          profit: profit.toFixed(2)
        }));
        
      case "weekly_profit_summary":
        // Simple implementation - group by week number in year
        const weeklyProfits = new Map<string, number>();
        filteredTransactions.forEach(t => {
          const date = new Date(t.date);
          const weekNumber = this.getWeekNumber(date);
          const year = date.getFullYear();
          const weekKey = `${year}-W${weekNumber}`;
          const profit = parseFloat(t.profit as any || "0");
          weeklyProfits.set(weekKey, (weeklyProfits.get(weekKey) || 0) + profit);
        });
        
        return Array.from(weeklyProfits.entries()).map(([weekKey, profit]) => ({
          week: weekKey,
          profit: profit.toFixed(2)
        }));
        
      case "monthly_profit_summary":
        // Group transactions by month
        const monthlyProfits = new Map<string, number>();
        filteredTransactions.forEach(t => {
          const date = new Date(t.date);
          const monthKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
          const profit = parseFloat(t.profit as any || "0");
          monthlyProfits.set(monthKey, (monthlyProfits.get(monthKey) || 0) + profit);
        });
        
        return Array.from(monthlyProfits.entries()).map(([month, profit]) => ({
          month,
          profit: profit.toFixed(2)
        }));
        
      case "profit_by_customer":
        return customers.map(customer => {
          const customerTransactions = transactions.filter(t => t.customer_id === customer.customer_id);
          const totalProfit = customerTransactions.reduce((sum, t) => sum + parseFloat(t.profit as any || "0"), 0).toFixed(2);
          const transactionCount = customerTransactions.length;
          
          return {
            customer_id: customer.customer_id,
            customer_name: customer.customer_name,
            transaction_count: transactionCount,
            total_profit: totalProfit
          };
        });
        
      case "profit_by_vendor":
        return vendors.map(vendor => {
          const vendorTransactions = transactions.filter(t => t.vendor_id === vendor.vendor_id);
          const totalProfit = vendorTransactions.reduce((sum, t) => sum + parseFloat(t.profit as any || "0"), 0).toFixed(2);
          const transactionCount = vendorTransactions.length;
          
          return {
            vendor_id: vendor.vendor_id,
            vendor_name: vendor.vendor_name,
            transaction_count: transactionCount,
            total_profit: totalProfit
          };
        });
        
      case "transaction_status_report":
        return filteredTransactions.map(t => {
          const customer = this.customers.get(t.customer_id);
          const vendor = this.vendors.get(t.vendor_id);
          
          return {
            transaction_id: t.transaction_id,
            date: new Date(t.date).toISOString().split('T')[0],
            cheque_number: t.cheque_number,
            cheque_amount: t.cheque_amount,
            customer_name: customer?.customer_name || 'Unknown',
            vendor_name: vendor?.vendor_name || 'Unknown',
            status: t.status,
            customer_payment_status: parseFloat(t.paid_to_customer as any) >= parseFloat(t.net_payable_to_customer as any) ? 'Fully Paid' : 'Partially Paid',
            vendor_payment_status: parseFloat(t.received_from_vendor as any) >= parseFloat(t.amount_to_receive_from_vendor as any) ? 'Fully Received' : 'Partially Received'
          };
        });
        
      case "outstanding_balances":
        // Only transactions with outstanding balances
        return filteredTransactions
          .filter(t => {
            const customerOutstanding = parseFloat(t.net_payable_to_customer as any) - parseFloat(t.paid_to_customer as any) > 0;
            const vendorOutstanding = parseFloat(t.amount_to_receive_from_vendor as any) - parseFloat(t.received_from_vendor as any) > 0;
            return customerOutstanding || vendorOutstanding;
          })
          .map(t => {
            const customer = this.customers.get(t.customer_id);
            const vendor = this.vendors.get(t.vendor_id);
            const customerOutstanding = (parseFloat(t.net_payable_to_customer as any) - parseFloat(t.paid_to_customer as any)).toFixed(2);
            const vendorOutstanding = (parseFloat(t.amount_to_receive_from_vendor as any) - parseFloat(t.received_from_vendor as any)).toFixed(2);
            
            return {
              transaction_id: t.transaction_id,
              date: new Date(t.date).toISOString().split('T')[0],
              cheque_number: t.cheque_number,
              customer_name: customer?.customer_name || 'Unknown',
              customer_outstanding: customerOutstanding,
              vendor_name: vendor?.vendor_name || 'Unknown',
              vendor_outstanding: vendorOutstanding
            };
          });
      
      default:
        // For other reports, return empty array
        return [];
    }
  }
  
  // Helper function to get week number
  private getWeekNumber(date: Date): number {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  }
  
  // AI Assistant methods
  async saveAIMessage(message: InsertAIMessage): Promise<AIMessage> {
    const newMessage: AIMessage = {
      ...message,
      message_id: this.nextMessageId++,
      created_at: new Date()
    };
    
    this.aiMessages.push(newMessage);
    return newMessage;
  }

  async getAIConversationHistory(conversationId: string): Promise<AIMessage[]> {
    // Get the conversation history with the max number of messages (for context window)
    const MAX_HISTORY = 35; // Increased from 10 to 35 as per requirements
    
    const messages = this.aiMessages
      .filter(message => message.conversation_id === conversationId)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    
    // Return the most recent MAX_HISTORY messages or all if less than MAX_HISTORY
    return messages.slice(-MAX_HISTORY);
  }

  // User management methods
  async getUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.username === username);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.email === email);
  }

  async createUser(user: InsertUser): Promise<User> {
    const newUser: User = {
      ...user,
      user_id: this.nextUserId++,
      created_at: new Date(),
      updated_at: new Date(),
      last_login: null
    };

    this.users.set(newUser.user_id, newUser);
    return newUser;
  }

  async updateUser(id: number, userData: Partial<UpdateUser>): Promise<User | undefined> {
    const existingUser = this.users.get(id);
    
    if (!existingUser) {
      return undefined;
    }
    
    const updatedUser: User = {
      ...existingUser,
      ...userData,
      updated_at: new Date()
    };
    
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async deleteUser(id: number): Promise<boolean> {
    // Check if user has conversations
    const hasConversations = Array.from(this.userConversations.values()).some(
      conversation => conversation.user_id === id
    );
    
    if (hasConversations) {
      // Delete associated conversations
      const userConversations = Array.from(this.userConversations.values())
        .filter(conversation => conversation.user_id === id);
      
      for (const conversation of userConversations) {
        this.userConversations.delete(conversation.conversation_id);
      }
    }
    
    return this.users.delete(id);
  }

  // User conversation methods
  async getUserConversations(userId: number): Promise<UserConversation[]> {
    return Array.from(this.userConversations.values())
      .filter(conversation => conversation.user_id === userId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  async getUserConversation(id: number): Promise<UserConversation | undefined> {
    return this.userConversations.get(id);
  }

  async createUserConversation(conversation: InsertUserConversation): Promise<UserConversation> {
    const newConversation: UserConversation = {
      ...conversation,
      conversation_id: this.nextConversationId++,
      created_at: new Date(),
      updated_at: new Date()
    };

    this.userConversations.set(newConversation.conversation_id, newConversation);
    return newConversation;
  }

  async updateUserConversation(id: number, conversationData: Partial<InsertUserConversation>): Promise<UserConversation | undefined> {
    const existingConversation = this.userConversations.get(id);
    
    if (!existingConversation) {
      return undefined;
    }
    
    const updatedConversation: UserConversation = {
      ...existingConversation,
      ...conversationData,
      updated_at: new Date()
    };
    
    this.userConversations.set(id, updatedConversation);
    return updatedConversation;
  }

  async deleteUserConversation(id: number): Promise<boolean> {
    return this.userConversations.delete(id);
  }
}

import { DatabaseStorage } from "./database-storage";

// Use Supabase database through DatabaseStorage 
export const storage = new DatabaseStorage();
