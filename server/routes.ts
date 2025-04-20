import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { insertTransactionSchema, insertCustomerSchema, insertVendorSchema } from "@shared/schema";
import OpenAI from "openai";
import multer from "multer";
import { processDocument } from "./services/documentProcessor";
import { sendTelegramMessage } from "./services/telegram";
import { generateAIResponse } from "./services/openai";

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
  app.get(`${apiRouter}/transactions`, async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      const offset = req.query.offset ? parseInt(req.query.offset as string) : undefined;
      const customerId = req.query.customerId ? parseInt(req.query.customerId as string) : undefined;
      const vendorId = req.query.vendorId as string | undefined;
      const status = req.query.status as string | undefined;
      
      // Try direct database connection first
      try {
        const { getTransactions } = await import('./direct-db');
        const transactions = await getTransactions();
        // Note: Direct connection doesn't support filtering yet
        res.json(transactions);
        return;
      } catch (directError) {
        console.error("Direct DB error:", directError);
        // Fall back to storage interface
        const transactions = await storage.getTransactions({ limit, offset, customerId, vendorId, status });
        res.json(transactions);
      }
    } catch (error) {
      console.error("Error getting transactions:", error);
      res.status(500).json({ message: "Failed to get transactions" });
    }
  });

  // Get transaction by ID
  app.get(`${apiRouter}/transactions/:id`, async (req, res) => {
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
  app.post(`${apiRouter}/transactions`, async (req, res) => {
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
  app.patch(`${apiRouter}/transactions/:id`, async (req, res) => {
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
  app.delete(`${apiRouter}/transactions/:id`, async (req, res) => {
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
  app.get(`${apiRouter}/customers`, async (req, res) => {
    try {
      const customers = await storage.getCustomers();
      res.json(customers);
    } catch (error) {
      console.error("Error getting customers:", error);
      res.status(500).json({ message: "Failed to get customers" });
    }
  });

  // Get customer by ID
  app.get(`${apiRouter}/customers/:id`, async (req, res) => {
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
  app.post(`${apiRouter}/customers`, async (req, res) => {
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
  app.patch(`${apiRouter}/customers/:id`, async (req, res) => {
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
  app.delete(`${apiRouter}/customers/:id`, async (req, res) => {
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

  // Get all vendors
  app.get(`${apiRouter}/vendors`, async (req, res) => {
    try {
      const vendors = await storage.getVendors();
      res.json(vendors);
    } catch (error) {
      console.error("Error getting vendors:", error);
      res.status(500).json({ message: "Failed to get vendors" });
    }
  });

  // Get vendor by ID
  app.get(`${apiRouter}/vendors/:id`, async (req, res) => {
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
  app.post(`${apiRouter}/vendors`, async (req, res) => {
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
  app.patch(`${apiRouter}/vendors/:id`, async (req, res) => {
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
  app.delete(`${apiRouter}/vendors/:id`, async (req, res) => {
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

  // Document processing
  app.post(`${apiRouter}/process-document`, upload.single('document'), async (req, res) => {
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

  // AI Assistant endpoint
  app.post(`${apiRouter}/ai-assistant`, async (req, res) => {
    try {
      const { message, conversationId, userId } = req.body;
      
      if (!message) {
        return res.status(400).json({ message: "No message provided" });
      }

      // Save user message
      await storage.saveAIMessage({
        content: message,
        role: 'user',
        conversation_id: conversationId || 'default',
        user_id: userId
      });

      // Generate AI response
      const aiResponse = await generateAIResponse(message, conversationId);

      // Save AI response
      await storage.saveAIMessage({
        content: aiResponse,
        role: 'assistant',
        conversation_id: conversationId || 'default',
        user_id: userId
      });

      res.json({ response: aiResponse });
    } catch (error) {
      console.error("Error generating AI response:", error);
      res.status(500).json({ message: "Failed to generate AI response" });
    }
  });

  // Get conversation history
  app.get(`${apiRouter}/ai-assistant/history/:conversationId`, async (req, res) => {
    try {
      const { conversationId } = req.params;
      const history = await storage.getAIConversationHistory(conversationId);
      res.json(history);
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

  const httpServer = createServer(app);
  return httpServer;
}
