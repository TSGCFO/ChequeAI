import { Express, Request, Response } from "express";
import { db } from "./db";
import { 
  users, userConversations, aiMessages,
  insertUserSchema, updateUserSchema, changePasswordSchema,
  User
} from "@shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { requireAuth, requireRole, hashPassword, comparePasswords } from "./auth";
import { z } from "zod";

/**
 * Register all user management routes
 * @param app Express application
 * @param apiRouter API router prefix
 */
export function registerUserRoutes(app: Express, apiRouter: string): void {
  // Get all users (admin only)
  app.get(`${apiRouter}/users`, requireRole(["superuser", "admin"]), async (req, res) => {
    try {
      const usersList = await db
        .select({
          user_id: users.user_id,
          username: users.username,
          email: users.email,
          role: users.role,
          first_name: users.first_name,
          last_name: users.last_name,
          is_active: users.is_active,
          last_login: users.last_login,
          created_at: users.created_at
        })
        .from(users)
        .orderBy(users.username);
      
      res.json(usersList);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Get a specific user by ID (admin only or self)
  app.get(`${apiRouter}/users/:id`, requireAuth, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      
      // Check authorization - users can only view themselves unless they're admins/superusers
      const currentUser = req.user as User;
      if (currentUser.user_id !== userId && !["superuser", "admin"].includes(currentUser.role)) {
        return res.status(403).json({ message: "Not authorized to view this user" });
      }
      
      const [user] = await db
        .select({
          user_id: users.user_id,
          username: users.username,
          email: users.email,
          role: users.role,
          first_name: users.first_name,
          last_name: users.last_name,
          is_active: users.is_active,
          last_login: users.last_login,
          created_at: users.created_at
        })
        .from(users)
        .where(eq(users.user_id, userId));
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json(user);
    } catch (error) {
      console.error(`Error fetching user ${req.params.id}:`, error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Create a new user (admin only)
  app.post(`${apiRouter}/users`, requireRole(["superuser", "admin"]), async (req, res) => {
    try {
      // Validate request body
      const validationResult = insertUserSchema.safeParse(req.body);
      
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid user data", 
          errors: validationResult.error.errors 
        });
      }
      
      // Check if username already exists
      const [existingUsername] = await db
        .select()
        .from(users)
        .where(eq(users.username, req.body.username));
        
      if (existingUsername) {
        return res.status(400).json({ message: "Username already exists" });
      }
      
      // Check if email already exists
      const [existingEmail] = await db
        .select()
        .from(users)
        .where(eq(users.email, req.body.email));
        
      if (existingEmail) {
        return res.status(400).json({ message: "Email already exists" });
      }
      
      // Only superusers can create other superusers
      const currentUser = req.user as User;
      if (req.body.role === "superuser" && currentUser.role !== "superuser") {
        return res.status(403).json({ message: "Only superusers can create other superusers" });
      }
      
      // Remove confirmPassword from payload and hash the password
      const { confirmPassword, ...userData } = validationResult.data;
      userData.password = await hashPassword(userData.password);
      
      // Insert the new user
      const [newUser] = await db.insert(users).values(userData).returning();
      
      // Remove password from response
      const { password, ...userResponse } = newUser;
      
      res.status(201).json(userResponse);
    } catch (error) {
      console.error("Error creating user:", error);
      res.status(500).json({ message: "Failed to create user" });
    }
  });

  // Update a user (admin or self)
  app.put(`${apiRouter}/users/:id`, requireAuth, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      
      // Check authorization
      const currentUser = req.user as User;
      const isSelf = currentUser.user_id === userId;
      const isAdminOrSuperuser = ["superuser", "admin"].includes(currentUser.role);
      
      if (!isSelf && !isAdminOrSuperuser) {
        return res.status(403).json({ message: "Not authorized to update this user" });
      }
      
      // Validate request body
      const validationResult = updateUserSchema.safeParse(req.body);
      
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid user data", 
          errors: validationResult.error.errors 
        });
      }
      
      // Get existing user
      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.user_id, userId));
        
      if (!existingUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Check role change constraints
      if (req.body.role && req.body.role !== existingUser.role) {
        // Regular users can't change roles at all
        if (!isAdminOrSuperuser) {
          return res.status(403).json({ message: "You don't have permission to change roles" });
        }
        
        // Only superusers can assign or remove superuser role
        if ((req.body.role === "superuser" || existingUser.role === "superuser") && 
            currentUser.role !== "superuser") {
          return res.status(403).json({ message: "Only superusers can assign or remove superuser role" });
        }
      }
      
      // Only superusers can disable other superusers
      if (req.body.is_active === false && existingUser.role === "superuser" && 
          currentUser.role !== "superuser") {
        return res.status(403).json({ message: "Only superusers can disable superuser accounts" });
      }
      
      // Update the user
      const [updatedUser] = await db
        .update(users)
        .set({
          ...req.body,
          updated_at: new Date()
        })
        .where(eq(users.user_id, userId))
        .returning();
      
      // Remove password from response
      const { password, ...userResponse } = updatedUser;
      
      res.json(userResponse);
    } catch (error) {
      console.error(`Error updating user ${req.params.id}:`, error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  // Change password
  app.post(`${apiRouter}/users/:id/change-password`, requireAuth, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      
      // Users can only change their own password unless they're admins
      const currentUser = req.user as User;
      const isSelf = currentUser.user_id === userId;
      const isAdminOrSuperuser = ["superuser", "admin"].includes(currentUser.role);
      
      if (!isSelf && !isAdminOrSuperuser) {
        return res.status(403).json({ message: "Not authorized to change this user's password" });
      }
      
      // Validate request body
      const validationResult = changePasswordSchema.safeParse(req.body);
      
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid password data", 
          errors: validationResult.error.errors 
        });
      }
      
      // Get existing user
      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.user_id, userId));
        
      if (!existingUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // If changing own password, verify current password
      if (isSelf) {
        const { currentPassword, newPassword } = validationResult.data;
        
        // Verify current password
        const isPasswordValid = await comparePasswords(currentPassword, existingUser.password);
        
        if (!isPasswordValid) {
          return res.status(400).json({ message: "Current password is incorrect" });
        }
        
        // Hash new password
        const hashedPassword = await hashPassword(newPassword);
        
        // Update password
        await db
          .update(users)
          .set({
            password: hashedPassword,
            updated_at: new Date()
          })
          .where(eq(users.user_id, userId));
      } else {
        // Admin is resetting someone else's password
        const { newPassword } = validationResult.data;
        
        // Hash new password
        const hashedPassword = await hashPassword(newPassword);
        
        // Update password
        await db
          .update(users)
          .set({
            password: hashedPassword,
            updated_at: new Date()
          })
          .where(eq(users.user_id, userId));
      }
      
      res.json({ message: "Password changed successfully" });
    } catch (error) {
      console.error(`Error changing password for user ${req.params.id}:`, error);
      res.status(500).json({ message: "Failed to change password" });
    }
  });

  // Delete a user (superuser only)
  app.delete(`${apiRouter}/users/:id`, requireRole(["superuser"]), async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      
      // Check if user exists
      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.user_id, userId));
        
      if (!existingUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Prevent deletion of the last superuser
      if (existingUser.role === "superuser") {
        const [superuserCount] = await db
          .select({ count: sql<number>`count(*)` })
          .from(users)
          .where(eq(users.role, "superuser"));
          
        if (superuserCount.count <= 1) {
          return res.status(400).json({ message: "Cannot delete the last superuser" });
        }
      }
      
      // Delete user's conversations and messages
      const userConversationIds = await db
        .select({ id: userConversations.conversation_id })
        .from(userConversations)
        .where(eq(userConversations.user_id, userId));
        
      // Delete AI messages for each conversation
      for (const conv of userConversationIds) {
        await db
          .delete(aiMessages)
          .where(eq(aiMessages.conversation_id, conv.id.toString()));
      }
      
      // Delete user conversations
      await db
        .delete(userConversations)
        .where(eq(userConversations.user_id, userId));
        
      // Finally, delete the user
      await db
        .delete(users)
        .where(eq(users.user_id, userId));
        
      res.status(200).json({ message: "User deleted successfully" });
    } catch (error) {
      console.error(`Error deleting user ${req.params.id}:`, error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // Get user conversations (for AI chat history)
  app.get(`${apiRouter}/users/:id/conversations`, requireAuth, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      
      // Users can only view their own conversations unless they're admins
      const currentUser = req.user as User;
      const isSelf = currentUser.user_id === userId;
      const isAdminOrSuperuser = ["superuser", "admin"].includes(currentUser.role);
      
      if (!isSelf && !isAdminOrSuperuser) {
        return res.status(403).json({ message: "Not authorized to view this user's conversations" });
      }
      
      // Get conversations
      const conversations = await db
        .select()
        .from(userConversations)
        .where(eq(userConversations.user_id, userId))
        .orderBy(desc(userConversations.updated_at));
        
      res.json(conversations);
    } catch (error) {
      console.error(`Error fetching conversations for user ${req.params.id}:`, error);
      res.status(500).json({ message: "Failed to fetch user conversations" });
    }
  });

  // Create a new conversation
  app.post(`${apiRouter}/users/:id/conversations`, requireAuth, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      
      // Users can only create conversations for themselves
      const currentUser = req.user as User;
      const isSelf = currentUser.user_id === userId;
      
      if (!isSelf) {
        return res.status(403).json({ message: "Not authorized to create conversations for this user" });
      }
      
      // Validate title
      const titleSchema = z.object({
        title: z.string().min(1).max(255).default("New Conversation")
      });
      
      const validationResult = titleSchema.safeParse(req.body);
      
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid title", 
          errors: validationResult.error.errors 
        });
      }
      
      // Create conversation
      const [newConversation] = await db
        .insert(userConversations)
        .values({
          user_id: userId,
          title: validationResult.data.title
        })
        .returning();
        
      res.status(201).json(newConversation);
    } catch (error) {
      console.error(`Error creating conversation for user ${req.params.id}:`, error);
      res.status(500).json({ message: "Failed to create conversation" });
    }
  });

  // Delete a conversation
  app.delete(`${apiRouter}/conversations/:id`, requireAuth, async (req, res) => {
    try {
      const conversationId = parseInt(req.params.id);
      
      // Get the conversation to check ownership
      const [conversation] = await db
        .select()
        .from(userConversations)
        .where(eq(userConversations.conversation_id, conversationId));
        
      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }
      
      // Check authorization
      const currentUser = req.user as User;
      const isOwner = currentUser.user_id === conversation.user_id;
      const isAdminOrSuperuser = ["superuser", "admin"].includes(currentUser.role);
      
      if (!isOwner && !isAdminOrSuperuser) {
        return res.status(403).json({ message: "Not authorized to delete this conversation" });
      }
      
      // Delete associated AI messages
      await db
        .delete(aiMessages)
        .where(eq(aiMessages.conversation_id, conversationId.toString()));
        
      // Delete the conversation
      await db
        .delete(userConversations)
        .where(eq(userConversations.conversation_id, conversationId));
        
      res.status(200).json({ message: "Conversation deleted successfully" });
    } catch (error) {
      console.error(`Error deleting conversation ${req.params.id}:`, error);
      res.status(500).json({ message: "Failed to delete conversation" });
    }
  });
}