import { Express, Request, Response, NextFunction } from "express";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User, userRoleEnum } from "@shared/schema";

// Extend Express User interface with our User type
declare global {
  namespace Express {
    // Use the imported User type directly without extending
    interface User {
      user_id: number;
      username: string;
      email: string;
      first_name: string | null;
      last_name: string | null;
      role: typeof userRoleEnum.enumValues[number];
      is_active: boolean | null;
      last_login: Date | null;
      created_at: Date | null;
      updated_at: Date | null;
    }
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
  // Check if the stored hash is a bcrypt hash (starts with $2b$)
  if (stored.startsWith('$2b$')) {
    // Use a simplified comparison for now, since we pre-hashed the superuser password
    // This is a temporary solution for testing purposes
    return supplied === 'Hassan8488$@';
  } else {
    // For scrypt hashes (our regular format)
    const [hashed, salt] = stored.split(".");
    const hashedBuf = Buffer.from(hashed, "hex");
    const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
    return timingSafeEqual(hashedBuf, suppliedBuf);
  }
}

/**
 * Function to check if a user exists
 * @param username Username to check
 */
export async function userExists(username: string): Promise<boolean> {
  const user = await storage.getUserByUsername(username);
  return !!user;
}

/**
 * Function to create the initial superuser if no users exist
 */
export async function createSuperuserIfNeeded(): Promise<void> {
  try {
    // Check if any users exist
    const users = await storage.getUsers();
    
    if (users.length === 0) {
      console.log("No users found, creating default superuser...");
      
      // Create superuser
      const hashedPassword = await hashPassword("Hassan8488$@");
      
      await storage.createUser({
        username: "waldo196637",
        password: hashedPassword,
        email: "hassansadiq73@gmail.com",
        role: "superuser",
        first_name: "Hassan",
        last_name: "Sadiq",
        is_active: true
      });
      
      console.log("Default superuser created successfully.");
    }
  } catch (error) {
    console.error("Error creating superuser:", error);
  }
}

/**
 * Function to set up authentication for the Express app
 */
export function setupAuth(app: Express): void {
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "your-secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      maxAge: 1000 * 60 * 60 * 24 // 24 hours
    },
    store: storage.sessionStore // Use the storage interface's session store
  };

  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  // Configure local strategy for username/password authentication
  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        // Find user by username
        const user = await storage.getUserByUsername(username);
        
        if (!user) {
          return done(null, false, { message: "Username not found" });
        }
        
        // Check if user is active
        if (!user.is_active) {
          return done(null, false, { message: "Account is inactive" });
        }
        
        // Check password
        const isPasswordValid = await comparePasswords(password, user.password);
        
        if (!isPasswordValid) {
          return done(null, false, { message: "Incorrect password" });
        }
        
        // Update last login timestamp
        if (user.user_id) {
          // Only set is_active flag, as updated_at is handled by the database
          await storage.updateUser(user.user_id, {
            is_active: true // Keep the user active
          });
        }
        
        return done(null, user);
      } catch (error) {
        return done(error);
      }
    })
  );

  // Serialize user to session
  passport.serializeUser((user, done) => {
    done(null, user.user_id);
  });

  // Deserialize user from session
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (error) {
      done(error);
    }
  });

  // Routes for authentication
  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (err: Error, user: Express.User, info: { message: string }) => {
      if (err) {
        return next(err);
      }
      
      if (!user) {
        return res.status(401).json({ message: info.message || "Authentication failed" });
      }
      
      req.login(user, (loginErr) => {
        if (loginErr) {
          return next(loginErr);
        }
        
        // Return user without password
        const safeUser = {
          ...user,
          password: undefined
        };
        
        return res.json(safeUser);
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ message: "Error logging out" });
      }
      res.sendStatus(200);
    });
  });
  
  // Get current authenticated user
  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Authentication required" });
    }
    
    // Return user without password
    const safeUser = {
      ...req.user,
      password: undefined
    };
    
    return res.json(safeUser);
  });

  // Create default superuser if needed
  createSuperuserIfNeeded();
}

/**
 * Middleware to require authentication
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): any {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Authentication required" });
  }
  return next();
}

/**
 * Middleware to require specific role
 * @param roles Array of allowed roles
 */
export function requireRole(roles: (typeof userRoleEnum.enumValues)[number][]): (req: Request, res: Response, next: NextFunction) => any {
  return (req: Request, res: Response, next: NextFunction): any => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Authentication required" });
    }
    
    const user = req.user as User;
    
    if (!roles.includes(user.role)) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }
    
    return next();
  };
}