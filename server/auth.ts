import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { db } from "./db";
import { users, User, userRoleEnum } from "@shared/schema";
import { eq } from "drizzle-orm";
import connectPg from "connect-pg-simple";
import { pool } from "./db";

declare global {
  namespace Express {
    interface User extends User {}
  }
}

const scryptAsync = promisify(scrypt);

/**
 * Hashes a password using scrypt with salt
 * @param password Plain text password to hash
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

/**
 * Compares a supplied password with a stored hashed password
 * @param supplied The supplied plain text password
 * @param stored The stored hashed password with salt
 */
export async function comparePasswords(supplied: string, stored: string): Promise<boolean> {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

/**
 * Function to check if a user exists
 * @param username Username to check
 */
export async function userExists(username: string): Promise<boolean> {
  const existingUser = await db.select().from(users).where(eq(users.username, username));
  return existingUser.length > 0;
}

/**
 * Function to create the initial superuser if no users exist
 */
export async function createSuperuserIfNeeded(): Promise<void> {
  // Check if any users exist
  const existingUsers = await db.select().from(users);
  
  if (existingUsers.length === 0) {
    // Create superuser
    console.log("No users found, creating superuser account");
    const hashedPassword = await hashPassword("Hassan8488$@");
    
    await db.insert(users).values({
      username: "waldo196637",
      password: hashedPassword,
      email: "hassansadiq73@gmail.com",
      role: "superuser",
      first_name: "Super",
      last_name: "User",
      is_active: true
    });
    
    console.log("Superuser account created successfully");
  }
}

/**
 * Function to set up authentication for the Express app
 */
export function setupAuth(app: Express): void {
  // Initialize PostgreSQL session store
  const PostgresSessionStore = connectPg(session);
  
  // Set up session
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "a-very-secret-key-replace-in-production",
    resave: false,
    saveUninitialized: false,
    store: new PostgresSessionStore({
      pool,
      tableName: "user_sessions", // Optional. Default is "session"
      createTableIfMissing: true
    }),
    cookie: {
      secure: process.env.NODE_ENV === "production",
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  };
  
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());
  
  // Set up LocalStrategy for username/password authentication
  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const [user] = await db.select().from(users).where(eq(users.username, username));
        
        if (!user || !(await comparePasswords(password, user.password))) {
          return done(null, false, { message: "Invalid username or password" });
        }
        
        if (!user.is_active) {
          return done(null, false, { message: "Account is disabled" });
        }
        
        // Update last login time
        await db
          .update(users)
          .set({ last_login: new Date() })
          .where(eq(users.user_id, user.user_id));
        
        return done(null, user);
      } catch (error) {
        return done(error);
      }
    })
  );
  
  // Serialize user to session
  passport.serializeUser((user: Express.User, done) => {
    done(null, user.user_id);
  });
  
  // Deserialize user from session
  passport.deserializeUser(async (id: number, done) => {
    try {
      const [user] = await db.select().from(users).where(eq(users.user_id, id));
      done(null, user);
    } catch (error) {
      done(error);
    }
  });
  
  // Set up auth routes
  app.post("/api/auth/login", (req, res, next) => {
    passport.authenticate("local", (err: Error, user: Express.User, info: { message: string }) => {
      if (err) {
        return next(err);
      }
      
      if (!user) {
        return res.status(401).json({ message: info.message || "Authentication failed" });
      }
      
      req.login(user, (err) => {
        if (err) {
          return next(err);
        }
        
        // Return basic user info (excluding password)
        const { password, ...userInfo } = user;
        return res.status(200).json(userInfo);
      });
    })(req, res, next);
  });
  
  app.post("/api/auth/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ message: "Error logging out" });
      }
      res.status(200).json({ message: "Logged out successfully" });
    });
  });
  
  app.get("/api/auth/user", (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    // Return basic user info (excluding password)
    const { password, ...userInfo } = req.user as User;
    res.status(200).json(userInfo);
  });
  
  // Create superuser if no users exist
  createSuperuserIfNeeded().catch(err => {
    console.error("Error creating superuser:", err);
  });
}

/**
 * Middleware to require authentication
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (req.isAuthenticated()) {
    return next();
  }
  
  res.status(401).json({ message: "Authentication required" });
}

/**
 * Middleware to require specific role
 * @param roles Array of allowed roles
 */
export function requireRole(roles: (typeof userRoleEnum.enumValues)[number][]): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Authentication required" });
    }
    
    const user = req.user as User;
    
    if (!roles.includes(user.role)) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }
    
    next();
  };
}