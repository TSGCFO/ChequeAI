import express, { type Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { 
  insertTransactionSchema, 
  insertCustomerSchema, 
  insertVendorSchema, 
  userConversations, 
  insertCustomerDepositSchema,
  type User
} from "@shared/schema";
import OpenAI from "openai";
import multer from "multer";
import { processDocument } from "./services/documentProcessor";
import { sendTelegramMessage } from "./services/telegram";
import { generateAIResponse, processChequeDocument } from "./services/openai";
import { setupAuth, requireAuth } from "./auth";
import { registerUserRoutes } from "./user-routes";
import { registerReportRoutes } from "./report-routes";
import { db } from "./db";
import { eq } from "drizzle-orm";

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

export async function registerRoutes(app: Express): Promise<Server> {
  // API routes prefix
  const apiRouter = "/api";

  // Set up authentication
  setupAuth(app);
  
  // Register user management routes
  registerUserRoutes(app, apiRouter);
  
  // Register report routes for database schema exploration
  registerReportRoutes(app, apiRouter);

  // OpenAI client
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || "",
  });

  // Get business summary
  app.get(`${apiRouter}/summary`, async (req, res) => {
    try {
      // Try to use direct database connection first
      const { getBusinessSummary } = await import('./direct-db');
      const summary = await getBusinessSummary();
      res.json(summary);
    } catch (error) {
      console.error("Error getting business summary:", error);
      try {
        // Fallback to storage interface
        const summary = await storage.getBusinessSummary();
        res.json(summary);
      } catch (fallbackError) {
        console.error("Fallback error:", fallbackError);
        res.status(500).json({ message: "Failed to get business summary" });
      }
    }
  });
  
  // Reports endpoints
  app.get(`${apiRouter}/reports/customer-balances`, async (req, res) => {
    try {
      const results = await storage.getReportData("customer_balances");
      res.json(results);
    } catch (error) {
      console.error("Error retrieving customer balances report:", error);
      res.status(500).json({ error: "Failed to retrieve customer balances report" });
    }
  });

  app.get(`${apiRouter}/reports/vendor-balances`, async (req, res) => {
    try {
      const results = await storage.getReportData("vendor_balances");
      res.json(results);
    } catch (error) {
      console.error("Error retrieving vendor balances report:", error);
      res.status(500).json({ error: "Failed to retrieve vendor balances report" });
    }
  });

  app.get(`${apiRouter}/reports/profit-summary/daily`, async (req, res) => {
    try {
      const results = await storage.getReportData("daily_profit_summary");
      res.json(results);
    } catch (error) {
      console.error("Error retrieving daily profit summary report:", error);
      res.status(500).json({ error: "Failed to retrieve daily profit summary report" });
    }
  });

  app.get(`${apiRouter}/reports/profit-summary/weekly`, async (req, res) => {
    try {
      const results = await storage.getReportData("weekly_profit_summary");
      res.json(results);
    } catch (error) {
      console.error("Error retrieving weekly profit summary report:", error);
      res.status(500).json({ error: "Failed to retrieve weekly profit summary report" });
    }
  });

  app.get(`${apiRouter}/reports/profit-summary/monthly`, async (req, res) => {
    try {
      const results = await storage.getReportData("monthly_profit_summary");
      res.json(results);
    } catch (error) {
      console.error("Error retrieving monthly profit summary report:", error);
      res.status(500).json({ error: "Failed to retrieve monthly profit summary report" });
    }
  });

  app.get(`${apiRouter}/reports/profit-by-customer`, async (req, res) => {
    try {
      const results = await storage.getReportData("profit_by_customer");
      res.json(results);
    } catch (error) {
      console.error("Error retrieving profit by customer report:", error);
      res.status(500).json({ error: "Failed to retrieve profit by customer report" });
    }
  });

  app.get(`${apiRouter}/reports/profit-by-vendor`, async (req, res) => {
    try {
      const results = await storage.getReportData("profit_by_vendor");
      res.json(results);
    } catch (error) {
      console.error("Error retrieving profit by vendor report:", error);
      res.status(500).json({ error: "Failed to retrieve profit by vendor report" });
    }
  });

  app.get(`${apiRouter}/reports/transaction-status`, async (req, res) => {
    try {
      const results = await storage.getReportData("transaction_status_report");
      res.json(results);
    } catch (error) {
      console.error("Error retrieving transaction status report:", error);
      res.status(500).json({ error: "Failed to retrieve transaction status report" });
    }
  });

  app.get(`${apiRouter}/reports/outstanding-balances`, async (req, res) => {
    try {
      const results = await storage.getReportData("outstanding_balances");
      res.json(results);
    } catch (error) {
      console.error("Error retrieving outstanding balances report:", error);
      res.status(500).json({ error: "Failed to retrieve outstanding balances report" });
    }
  });

  app.get(`${apiRouter}/reports/customer-detailed-transactions`, async (req, res) => {
    try {
      const customerId = req.query.customerId ? Number(req.query.customerId) : undefined;
      const results = await storage.getReportData("customer_detailed_transactions", { customerId });
      res.json(results);
    } catch (error) {
      console.error("Error retrieving customer detailed transactions report:", error);
      res.status(500).json({ error: "Failed to retrieve customer detailed transactions report" });
    }
  });

  app.get(`${apiRouter}/reports/vendor-detailed-transactions`, async (req, res) => {
    try {
      const vendorId = req.query.vendorId as string | undefined;
      const results = await storage.getReportData("vendor_detailed_transactions", { vendorId });
      res.json(results);
    } catch (error) {
      console.error("Error retrieving vendor detailed transactions report:", error);
      res.status(500).json({ error: "Failed to retrieve vendor detailed transactions report" });
    }
  });

  // Get all transactions
  app.get(`${apiRouter}/transactions`, requireAuth, async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      const offset = req.query.offset ? parseInt(req.query.offset as string) : undefined;
      const customerId = req.query.customerId ? parseInt(req.query.customerId as string) : undefined;
      const vendorId = req.query.vendorId as string | undefined;
      const status = req.query.status as string | undefined;
      
      try {
        // Get all transactions with customer and vendor details
        const transactions = await storage.getTransactions({ limit, offset, customerId, vendorId, status });
        
        // Also fetch customer and vendor data and enrich transactions
        const customers = await storage.getCustomers();
        const vendors = await storage.getVendors();
        
        // Prepare lookup tables for customers and vendors
        const customerMap = new Map(customers.map(c => [c.customer_id, c]));
        const vendorMap = new Map(vendors.map(v => [v.vendor_id, v]));
        
        // Enrich transactions with detailed customer and vendor data
        const enrichedTransactions = transactions.map(transaction => {
          return {
            ...transaction,
            customer: customerMap.get(transaction.customer_id) || { customer_name: "Unknown" },
            vendor: vendorMap.get(transaction.vendor_id) || { vendor_name: "Unknown" }
          };
        });
        
        res.json(enrichedTransactions);
      } catch (error) {
        console.error("Error in transaction processing:", error);
        res.status(500).json({ message: "Failed to get transactions" });
      }
    } catch (error) {
      console.error("Error getting transactions:", error);
      res.status(500).json({ message: "Failed to get transactions" });
    }
  });

  // Get transaction by ID
  app.get(`${apiRouter}/transactions/:id`, requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const transaction = await storage.getTransactionWithDetails(id);
      
      if (!transaction) {
        return res.status(404).json({ message: "Transaction not found" });
      }
      
      res.json(transaction);
    } catch (error) {
      console.error("Error getting transaction:", error);
      res.status(500).json({ message: "Failed to get transaction" });
    }
  });

  // Create transaction
  app.post(`${apiRouter}/transactions`, requireAuth, async (req, res) => {
    try {
      const validatedData = insertTransactionSchema.parse(req.body);
      const transaction = await storage.createTransaction(validatedData);
      res.status(201).json(transaction);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Error creating transaction:", error);
      res.status(500).json({ message: "Failed to create transaction" });
    }
  });

  // Update transaction
  app.patch(`${apiRouter}/transactions/:id`, requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertTransactionSchema.partial().parse(req.body);
      const transaction = await storage.updateTransaction(id, validatedData);
      
      if (!transaction) {
        return res.status(404).json({ message: "Transaction not found" });
      }
      
      res.json(transaction);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Error updating transaction:", error);
      res.status(500).json({ message: "Failed to update transaction" });
    }
  });

  // Delete transaction
  app.delete(`${apiRouter}/transactions/:id`, requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteTransaction(id);
      
      if (!success) {
        return res.status(404).json({ message: "Transaction not found" });
      }
      
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting transaction:", error);
      res.status(500).json({ message: "Failed to delete transaction" });
    }
  });

  // Get all customers
  app.get(`${apiRouter}/customers`, requireAuth, async (req, res) => {
    try {
      const customers = await storage.getCustomers();
      res.json(customers);
    } catch (error) {
      console.error("Error getting customers:", error);
      res.status(500).json({ message: "Failed to get customers" });
    }
  });

  // Get customer by ID
  app.get(`${apiRouter}/customers/:id`, requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const customer = await storage.getCustomer(id);
      
      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }
      
      res.json(customer);
    } catch (error) {
      console.error("Error getting customer:", error);
      res.status(500).json({ message: "Failed to get customer" });
    }
  });

  // Create customer
  app.post(`${apiRouter}/customers`, requireAuth, async (req, res) => {
    try {
      const validatedData = insertCustomerSchema.parse(req.body);
      const customer = await storage.createCustomer(validatedData);
      res.status(201).json(customer);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Error creating customer:", error);
      res.status(500).json({ message: "Failed to create customer" });
    }
  });

  // Update customer
  app.patch(`${apiRouter}/customers/:id`, requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertCustomerSchema.partial().parse(req.body);
      const customer = await storage.updateCustomer(id, validatedData);
      
      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }
      
      res.json(customer);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Error updating customer:", error);
      res.status(500).json({ message: "Failed to update customer" });
    }
  });

  // Delete customer
  app.delete(`${apiRouter}/customers/:id`, requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteCustomer(id);
      
      if (!success) {
        return res.status(404).json({ message: "Customer not found" });
      }
      
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting customer:", error);
      res.status(500).json({ message: "Failed to delete customer" });
    }
  });
  
  // Create customer deposit
  app.post(`${apiRouter}/deposits`, requireAuth, async (req, res) => {
    try {
      const validatedData = insertCustomerDepositSchema.parse(req.body);
      const deposit = await storage.createCustomerDeposit(validatedData);
      res.status(201).json(deposit);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Error creating customer deposit:", error);
      res.status(500).json({ message: "Failed to create customer deposit" });
    }
  });

  // Get all vendors
  app.get(`${apiRouter}/vendors`, requireAuth, async (req, res) => {
    try {
      const vendors = await storage.getVendors();
      res.json(vendors);
    } catch (error) {
      console.error("Error getting vendors:", error);
      res.status(500).json({ message: "Failed to get vendors" });
    }
  });

  // Get vendor by ID
  app.get(`${apiRouter}/vendors/:id`, requireAuth, async (req, res) => {
    try {
      const id = req.params.id;
      const vendor = await storage.getVendor(id);
      
      if (!vendor) {
        return res.status(404).json({ message: "Vendor not found" });
      }
      
      res.json(vendor);
    } catch (error) {
      console.error("Error getting vendor:", error);
      res.status(500).json({ message: "Failed to get vendor" });
    }
  });

  // Create vendor
  app.post(`${apiRouter}/vendors`, requireAuth, async (req, res) => {
    try {
      const validatedData = insertVendorSchema.parse(req.body);
      const vendor = await storage.createVendor(validatedData);
      res.status(201).json(vendor);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Error creating vendor:", error);
      res.status(500).json({ message: "Failed to create vendor" });
    }
  });

  // Update vendor
  app.patch(`${apiRouter}/vendors/:id`, requireAuth, async (req, res) => {
    try {
      const id = req.params.id;
      const validatedData = insertVendorSchema.partial().parse(req.body);
      const vendor = await storage.updateVendor(id, validatedData);
      
      if (!vendor) {
        return res.status(404).json({ message: "Vendor not found" });
      }
      
      res.json(vendor);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Error updating vendor:", error);
      res.status(500).json({ message: "Failed to update vendor" });
    }
  });

  // Delete vendor
  app.delete(`${apiRouter}/vendors/:id`, requireAuth, async (req, res) => {
    try {
      const id = req.params.id;
      const success = await storage.deleteVendor(id);
      
      if (!success) {
        return res.status(404).json({ message: "Vendor not found" });
      }
      
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting vendor:", error);
      res.status(500).json({ message: "Failed to delete vendor" });
    }
  });

  // Document processing with Tesseract
  app.post(`${apiRouter}/process-document`, requireAuth, upload.single('document'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No document uploaded" });
      }

      const extractOptions = {
        extractChequeNumber: req.body.extractChequeNumber === 'true',
        extractAmount: req.body.extractAmount === 'true',
        extractDate: req.body.extractDate === 'true',
        autoAssignCustomer: req.body.autoAssignCustomer === 'true'
      };

      const result = await processDocument(req.file.buffer, extractOptions);
      res.json(result);
    } catch (error) {
      console.error("Error processing document:", error);
      res.status(500).json({ message: "Failed to process document" });
    }
  });
  
  // AI-powered document processing using OpenAI vision model
  app.post(`${apiRouter}/process-cheque`, requireAuth, upload.single('document'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No document uploaded" });
      }
      
      // Create a unique conversation ID for web interface
      const conversationId = `session-${Date.now()}`;
      
      // Extract file details
      const fileBuffer = req.file.buffer;
      const fileType = req.file.mimetype;
      
      // Process the document using the OpenAI-based cheque processing function
      const result = await processChequeDocument(fileBuffer, fileType, conversationId);
      
      // Return the conversationId to the client so it can fetch the AI assistant responses
      res.json({ 
        success: true, 
        message: result,
        conversationId
      });
    } catch (error) {
      console.error("Error processing cheque document:", error);
      res.status(500).json({ 
        success: false, 
        error: "Cheque document processing failed" 
      });
    }
  });

  // AI Assistant endpoint
  app.post(`${apiRouter}/ai-assistant`, requireAuth, async (req, res) => {
    try {
      const { message, conversationId } = req.body;
      
      if (!message) {
        return res.status(400).json({ message: "No message provided" });
      }

      // Get the current user
      const currentUser = req.user as User;
      
      // For database-stored conversations, verify ownership
      if (conversationId && !conversationId.startsWith("session-")) {
        try {
          const convId = parseInt(conversationId);
          const [userConversation] = await db
            .select()
            .from(userConversations)
            .where(eq(userConversations.conversation_id, convId));
            
          if (userConversation && userConversation.user_id !== currentUser.user_id && 
              !["superuser", "admin"].includes(currentUser.role)) {
            return res.status(403).json({ message: "Not authorized to use this conversation" });
          }
        } catch (error) {
          console.error("Error checking conversation ownership:", error);
        }
      }

      // If no conversationId provided, create a new one
      let finalConversationId = conversationId;
      if (!finalConversationId) {
        try {
          // Create a new conversation for this user
          const [newConversation] = await db
            .insert(userConversations)
            .values({
              user_id: currentUser.user_id,
              title: "New Conversation"
            })
            .returning();
            
          finalConversationId = newConversation.conversation_id.toString();
        } catch (error) {
          console.error("Error creating new conversation:", error);
          // Fall back to session ID if database error
          finalConversationId = `session-${Date.now()}`;
        }
      }

      // Save user message
      await storage.saveAIMessage({
        content: message,
        role: 'user',
        conversation_id: finalConversationId,
        user_id: currentUser.user_id
      });

      // Generate AI response - this function now handles saving the assistant's response
      const aiResponse = await generateAIResponse(message, finalConversationId);

      res.json({ response: aiResponse, conversationId: finalConversationId });
    } catch (error) {
      console.error("Error generating AI response:", error);
      res.status(500).json({ message: "Failed to generate AI response" });
    }
  });

  // Get conversation history
  app.get(`${apiRouter}/ai-assistant/history/:conversationId`, requireAuth, async (req, res) => {
    try {
      const { conversationId } = req.params;
      const currentUser = req.user as User;
      
      // For database-stored conversations, verify ownership
      if (conversationId && !conversationId.startsWith("session-")) {
        try {
          const convId = parseInt(conversationId);
          const [userConversation] = await db
            .select()
            .from(userConversations)
            .where(eq(userConversations.conversation_id, convId));
            
          if (userConversation && userConversation.user_id !== currentUser.user_id && 
              !["superuser", "admin"].includes(currentUser.role)) {
            return res.status(403).json({ message: "Not authorized to view this conversation" });
          }
        } catch (error) {
          console.error("Error checking conversation ownership:", error);
        }
      }
      
      // Get history
      const history = await storage.getAIConversationHistory(conversationId);
      
      // Process so we only return 35 most recent messages (user request)
      const recentHistory = history.slice(-35);
      
      res.json(recentHistory);
    } catch (error) {
      console.error("Error getting conversation history:", error);
      res.status(500).json({ message: "Failed to get conversation history" });
    }
  });

  // Send message to Telegram
  app.post(`${apiRouter}/telegram/send`, async (req, res) => {
    try {
      const { message, chatId } = req.body;
      
      if (!message || !chatId) {
        return res.status(400).json({ message: "Message and chatId are required" });
      }

      const result = await sendTelegramMessage(chatId, message);
      res.json(result);
    } catch (error) {
      console.error("Error sending Telegram message:", error);
      res.status(500).json({ message: "Failed to send Telegram message" });
    }
  });
  
  // Telegram webhook endpoint for production deployments
  app.post('/telegram-webhook', express.json(), (req, res) => {
    // Pass the update to the bot API
    if (process.env.TELEGRAM_BOT_TOKEN) {
      try {
        // Import needed only in this route to avoid initialization conflicts
        const { handleWebhookUpdate } = require('./services/telegram');
        handleWebhookUpdate(req.body);
        res.sendStatus(200);
      } catch (error) {
        console.error('Error handling Telegram webhook:', error);
        res.sendStatus(500);
      }
    } else {
      console.log('Telegram webhook received but no token is configured');
      res.sendStatus(404);
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
