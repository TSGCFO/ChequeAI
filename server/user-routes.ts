import type { Express, Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import { z } from "zod";
import { loginUserSchema, insertUserSchema, updateUserSchema, changePasswordSchema, userRoleEnum } from "@shared/schema";
import { comparePasswords, hashPassword, requireAuth, requireRole } from "./auth";

/**
 * Register all user management routes
 * @param app Express application
 * @param apiRouter API router prefix
 */
export function registerUserRoutes(app: Express, apiRouter: string): void {
  // Get current user profile
  app.get(`${apiRouter}/user/profile`, requireAuth, async (req, res) => {
    try {
      const user = req.user;
      
      // Remove sensitive information
      const safeUser = {
        ...user,
        password: undefined
      };
      
      res.json(safeUser);
    } catch (error) {
      console.error("Error getting user profile:", error);
      res.status(500).json({ message: "Failed to get user profile" });
    }
  });

  // Public user registration endpoint (for testing)
  app.post(`${apiRouter}/register`, async (req, res) => {
    try {
      const validatedData = insertUserSchema.parse(req.body);
      
      // Check if user already exists
      const existingUser = await storage.getUserByUsername(validatedData.username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }

      // Hash password
      const hashedPassword = await hashPassword(validatedData.password);
      
      // Create user without the confirmPassword field
      const { confirmPassword, ...userData } = validatedData;
      
      const newUser = await storage.createUser({
        ...userData,
        password: hashedPassword
      });
      
      // Remove sensitive information
      const safeUser = {
        ...newUser,
        password: undefined
      };
      
      // Log the user in automatically
      req.login(newUser, (loginErr) => {
        if (loginErr) {
          console.error("Error logging in new user:", loginErr);
          return res.status(201).json({ 
            message: "User created successfully, but automatic login failed. Please log in manually.",
            user: safeUser
          });
        }
        
        return res.status(201).json({ 
          message: "User created and logged in successfully",
          user: safeUser
        });
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Error registering user:", error);
      res.status(500).json({ message: "Failed to register user" });
    }
  });
  
  // Register user (for admin/superuser only)
  app.post(`${apiRouter}/user/register`, requireAuth, requireRole(['superuser', 'admin']), async (req, res) => {
    try {
      const validatedData = insertUserSchema.parse(req.body);
      
      // Check if user already exists
      const existingUser = await storage.getUserByUsername(validatedData.username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }

      // Hash password
      const hashedPassword = await hashPassword(validatedData.password);
      
      // Create user without the confirmPassword field
      const { confirmPassword, ...userData } = validatedData;
      
      const newUser = await storage.createUser({
        ...userData,
        password: hashedPassword
      });
      
      // Remove sensitive information
      const safeUser = {
        ...newUser,
        password: undefined
      };
      
      res.status(201).json(safeUser);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Error registering user:", error);
      res.status(500).json({ message: "Failed to register user" });
    }
  });

  // Update user profile
  app.patch(`${apiRouter}/user/profile`, requireAuth, async (req, res) => {
    try {
      const currentUser = req.user;
      const validatedData = updateUserSchema.parse(req.body);
      
      const updatedUser = await storage.updateUser(currentUser.user_id, validatedData);
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Remove sensitive information
      const safeUser = {
        ...updatedUser,
        password: undefined
      };
      
      res.json(safeUser);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Error updating user profile:", error);
      res.status(500).json({ message: "Failed to update user profile" });
    }
  });

  // Change password
  app.post(`${apiRouter}/user/change-password`, requireAuth, async (req, res) => {
    try {
      const currentUser = req.user;
      const validatedData = changePasswordSchema.parse(req.body);
      
      // Verify current password
      const isPasswordValid = await comparePasswords(validatedData.currentPassword, currentUser.password);
      if (!isPasswordValid) {
        return res.status(400).json({ message: "Current password is incorrect" });
      }
      
      // Hash new password
      const hashedPassword = await hashPassword(validatedData.newPassword);
      
      // Update password
      const updatedUser = await storage.updateUser(currentUser.user_id, {
        password: hashedPassword
      });
      
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json({ message: "Password changed successfully" });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Error changing password:", error);
      res.status(500).json({ message: "Failed to change password" });
    }
  });

  // User management (for superuser role only)
  // Get all users (with special handling for no-users case)
  app.get(`${apiRouter}/users`, async (req, res) => {
    try {
      const users = await storage.getUsers();
      
      // Special case: If no users exist, return a helpful message
      if (users.length === 0) {
        return res.status(404).json({
          message: "No users found in the system. Use the /api/initial-setup endpoint to create the first superuser account."
        });
      }
      
      // Otherwise, enforce authentication and authorization
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      // Only superusers can list all users
      const user = req.user as Express.User;
      if (user.role !== 'superuser') {
        return res.status(403).json({ message: "Only superusers can view the list of all users" });
      }
      
      // Remove sensitive information
      const safeUsers = users.map(user => ({
        ...user,
        password: undefined
      }));
      
      res.json(safeUsers);
    } catch (error) {
      console.error("Error getting users:", error);
      res.status(500).json({ message: "Failed to get users" });
    }
  });

  // Get user by ID
  app.get(`${apiRouter}/users/:id`, requireAuth, requireRole(['superuser']), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const user = await storage.getUser(id);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Remove sensitive information
      const safeUser = {
        ...user,
        password: undefined
      };
      
      res.json(safeUser);
    } catch (error) {
      console.error("Error getting user:", error);
      res.status(500).json({ message: "Failed to get user" });
    }
  });

  // Update user (for superuser role only)
  app.patch(`${apiRouter}/users/:id`, requireAuth, requireRole(['superuser']), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = updateUserSchema.parse(req.body);
      
      const updatedUser = await storage.updateUser(id, validatedData);
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Remove sensitive information
      const safeUser = {
        ...updatedUser,
        password: undefined
      };
      
      res.json(safeUser);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Error updating user:", error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  // Delete user (for superuser role only)
  app.delete(`${apiRouter}/users/:id`, requireAuth, requireRole(['superuser']), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Prevent deleting yourself
      if (req.user.user_id === id) {
        return res.status(400).json({ message: "Cannot delete your own account" });
      }
      
      const success = await storage.deleteUser(id);
      if (!success) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // Get user conversations
  app.get(`${apiRouter}/user/conversations`, requireAuth, async (req, res) => {
    try {
      const userId = req.user.user_id;
      const conversations = await storage.getUserConversations(userId);
      res.json(conversations);
    } catch (error) {
      console.error("Error getting user conversations:", error);
      res.status(500).json({ message: "Failed to get user conversations" });
    }
  });

  // Create new conversation
  app.post(`${apiRouter}/user/conversations`, requireAuth, async (req, res) => {
    try {
      const userId = req.user.user_id;
      const { title } = req.body;
      
      const conversation = await storage.createUserConversation({
        user_id: userId,
        title: title || "New Conversation"
      });
      
      res.status(201).json(conversation);
    } catch (error) {
      console.error("Error creating conversation:", error);
      res.status(500).json({ message: "Failed to create conversation" });
    }
  });

  // Delete conversation
  app.delete(`${apiRouter}/user/conversations/:id`, requireAuth, async (req, res) => {
    try {
      const userId = req.user.user_id;
      const conversationId = parseInt(req.params.id);
      
      // Verify ownership
      const conversation = await storage.getUserConversation(conversationId);
      
      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }
      
      // Only allow users to delete their own conversations (unless superuser/admin)
      if (conversation.user_id !== userId && !['superuser', 'admin'].includes(req.user.role)) {
        return res.status(403).json({ message: "Not authorized to delete this conversation" });
      }
      
      const success = await storage.deleteUserConversation(conversationId);
      if (!success) {
        return res.status(404).json({ message: "Conversation not found" });
      }
      
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting conversation:", error);
      res.status(500).json({ message: "Failed to delete conversation" });
    }
  });
}