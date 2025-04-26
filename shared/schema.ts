import { pgTable, text, integer, numeric, date, boolean, timestamp, serial, varchar, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User Role Enum
export const userRoleEnum = pgEnum('user_role', ['superuser', 'admin', 'user']);

// Users Table
export const users = pgTable("users", {
  user_id: serial("user_id").primaryKey(),
  username: varchar("username", { length: 255 }).notNull().unique(),
  password: varchar("password", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  role: userRoleEnum("role").notNull().default('user'),
  first_name: varchar("first_name", { length: 255 }),
  last_name: varchar("last_name", { length: 255 }),
  is_active: boolean("is_active").default(true),
  last_login: timestamp("last_login"),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow()
});

// User Conversations Table (to track conversation context per user)
export const userConversations = pgTable("user_conversations", {
  conversation_id: serial("conversation_id").primaryKey(),
  user_id: integer("user_id").notNull().references(() => users.user_id),
  title: varchar("title", { length: 255 }).default('New Conversation'),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow()
});

// Customers Table
export const customers = pgTable("customers", {
  customer_id: integer("customer_id").primaryKey(),
  customer_name: varchar("customer_name", { length: 255 }).notNull(),
  contact_info: varchar("contact_info", { length: 255 }),
  fee_percentage: numeric("fee_percentage", { precision: 5, scale: 2 }).notNull(),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow()
});

// Vendors Table
export const vendors = pgTable("vendors", {
  vendor_id: varchar("vendor_id", { length: 20 }).primaryKey(),
  vendor_name: varchar("vendor_name", { length: 255 }).notNull(),
  fee_percentage: numeric("fee_percentage", { precision: 5, scale: 2 }).notNull(),
  contact_info: varchar("contact_info", { length: 255 }),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow()
});

// Transactions Table
export const chequeTransactions = pgTable("cheque_transactions", {
  transaction_id: integer("transaction_id").primaryKey(),
  date: date("date").defaultNow(),
  customer_id: integer("customer_id").notNull().references(() => customers.customer_id),
  cheque_number: varchar("cheque_number", { length: 50 }).notNull(),
  cheque_amount: numeric("cheque_amount", { precision: 10, scale: 2 }).notNull(),
  customer_fee: numeric("customer_fee", { precision: 10, scale: 2 }),
  net_payable_to_customer: numeric("net_payable_to_customer", { precision: 10, scale: 2 }),
  vendor_id: varchar("vendor_id", { length: 20 }).notNull().references(() => vendors.vendor_id),
  vendor_fee: numeric("vendor_fee", { precision: 10, scale: 2 }),
  amount_to_receive_from_vendor: numeric("amount_to_receive_from_vendor", { precision: 10, scale: 2 }),
  profit: numeric("profit", { precision: 10, scale: 2 }),
  paid_to_customer: numeric("paid_to_customer", { precision: 10, scale: 2 }).default("0"),
  received_from_vendor: numeric("received_from_vendor", { precision: 10, scale: 2 }).default("0"),
  profit_withdrawn: numeric("profit_withdrawn", { precision: 10, scale: 2 }).default("0"),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow()
});

// Customer deposits
export const customerDeposits = pgTable("customer_deposits", {
  deposit_id: serial("deposit_id").primaryKey(),
  customer_id: integer("customer_id").notNull().references(() => customers.customer_id),
  date: date("date").defaultNow(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  fully_allocated: boolean("fully_allocated").default(false),
  notes: text("notes"),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow()
});

// Vendor payments
export const vendorPayments = pgTable("vendor_payments", {
  payment_id: serial("payment_id").primaryKey(),
  vendor_id: varchar("vendor_id", { length: 20 }).notNull().references(() => vendors.vendor_id),
  date: date("date").defaultNow(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  fully_allocated: boolean("fully_allocated").default(false),
  notes: text("notes"),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow()
});

// Telegram Users Table
export const telegramUsers = pgTable("telegram_users", {
  telegram_id: integer("telegram_id").primaryKey(),
  user_id: integer("user_id").notNull().references(() => users.user_id),
  username: text("username"),
  first_name: text("first_name"),
  last_name: text("last_name"),
  role: text("role"),
  last_activity: timestamp("last_activity", { withTimezone: true }).defaultNow()
});

// AI Assistant Messages
export const aiMessages = pgTable("ai_messages", {
  message_id: serial("message_id").primaryKey(),
  user_id: integer("user_id"),
  content: text("content").notNull(),
  role: text("role").notNull(), // 'user' or 'assistant'
  created_at: timestamp("created_at").defaultNow(),
  conversation_id: text("conversation_id").notNull()
});

// Create insert schemas
export const insertCustomerSchema = createInsertSchema(customers).omit({ 
  created_at: true,
  updated_at: true 
});

export const insertVendorSchema = createInsertSchema(vendors).omit({ 
  created_at: true,
  updated_at: true,
  vendor_id: true // Auto-generated by trigger
});

export const insertTransactionSchema = createInsertSchema(chequeTransactions).omit({ 
  transaction_id: true, // Auto-generated field
  created_at: true,
  updated_at: true,
  customer_fee: true,
  net_payable_to_customer: true,
  vendor_fee: true,
  amount_to_receive_from_vendor: true,
  profit: true,
  paid_to_customer: true,
  received_from_vendor: true,
  profit_withdrawn: true
});

export const insertCustomerDepositSchema = createInsertSchema(customerDeposits).omit({
  deposit_id: true,
  created_at: true,
  updated_at: true,
  fully_allocated: true
});

export const insertVendorPaymentSchema = createInsertSchema(vendorPayments).omit({
  payment_id: true,
  created_at: true,
  updated_at: true,
  fully_allocated: true
});

export const insertAIMessageSchema = createInsertSchema(aiMessages).omit({
  message_id: true,
  created_at: true
});

// Telegram user schema
export const insertTelegramUserSchema = createInsertSchema(telegramUsers);

// User schemas
export const insertUserSchema = createInsertSchema(users).omit({
  user_id: true,
  created_at: true,
  updated_at: true,
  last_login: true
}).extend({
  // Add password confirmation for registration
  confirmPassword: z.string()
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"]
});

export const loginUserSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required")
});

export const updateUserSchema = createInsertSchema(users).omit({
  user_id: true,
  created_at: true,
  updated_at: true,
  last_login: true,
  password: true
}).partial();

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string()
}).refine(data => data.newPassword === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"]
});

export const insertUserConversationSchema = createInsertSchema(userConversations).omit({
  conversation_id: true,
  created_at: true,
  updated_at: true
});

// Create select types
export type User = typeof users.$inferSelect;
export type UserConversation = typeof userConversations.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type Vendor = typeof vendors.$inferSelect;
export type ChequeTransaction = typeof chequeTransactions.$inferSelect;
export type CustomerDeposit = typeof customerDeposits.$inferSelect;
export type VendorPayment = typeof vendorPayments.$inferSelect;
export type AIMessage = typeof aiMessages.$inferSelect;
export type TelegramUser = typeof telegramUsers.$inferSelect;

// Create insert types
export type InsertUser = Omit<z.infer<typeof insertUserSchema>, 'confirmPassword'>;
export type LoginUser = z.infer<typeof loginUserSchema>;
export type UpdateUser = z.infer<typeof updateUserSchema>;
export type ChangePassword = z.infer<typeof changePasswordSchema>;
export type InsertUserConversation = z.infer<typeof insertUserConversationSchema>;
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type InsertVendor = z.infer<typeof insertVendorSchema>;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type InsertCustomerDeposit = z.infer<typeof insertCustomerDepositSchema>;
export type InsertVendorPayment = z.infer<typeof insertVendorPaymentSchema>;
export type InsertAIMessage = z.infer<typeof insertAIMessageSchema>;
export type InsertTelegramUser = z.infer<typeof insertTelegramUserSchema>;

// Create a type for transaction with customer and vendor details
export type TransactionWithDetails = ChequeTransaction & {
  customer: Pick<Customer, 'customer_name'>;
  vendor: Pick<Vendor, 'vendor_name'>;
};

// Create a type for business summary
export type BusinessSummary = {
  totalTransactions: number;
  totalAmount: string;
  totalProfit: string;
  outstandingBalance: string;
  pendingTransactions: number;
  completedTransactions: number;
};
