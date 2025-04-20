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
  type InsertAIMessage
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
  
  // Business summary
  getBusinessSummary(): Promise<BusinessSummary>;
  
  // AI Assistant methods
  saveAIMessage(message: InsertAIMessage): Promise<AIMessage>;
  getAIConversationHistory(conversationId: string): Promise<AIMessage[]>;
}

export class MemStorage implements IStorage {
  private transactions: Map<number, ChequeTransaction>;
  private customers: Map<number, Customer>;
  private vendors: Map<string, Vendor>;
  private aiMessages: AIMessage[];
  private nextTransactionId: number;
  private nextCustomerId: number;
  private nextMessageId: number;
  
  constructor() {
    this.transactions = new Map();
    this.customers = new Map();
    this.vendors = new Map();
    this.aiMessages = [];
    this.nextTransactionId = 1;
    this.nextCustomerId = 1;
    this.nextMessageId = 1;
    
    // Add sample data
    this.initializeSampleData();
  }
  
  private initializeSampleData() {
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
    return this.aiMessages
      .filter(message => message.conversation_id === conversationId)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }
}

export const storage = new MemStorage();
