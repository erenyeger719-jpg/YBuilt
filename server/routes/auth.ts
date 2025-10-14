import { Router, Request, Response } from "express";
import bcrypt from "bcrypt";
import { z } from "zod";
import { storage } from "../storage.js";
import { generateToken, authenticateToken, type AuthRequest } from "../middleware/auth.js";
import { logger } from "../index.js";
import { insertUserSchema } from "@shared/schema";

const router = Router();

const SALT_ROUNDS = 10;

// Validation schemas
const registerSchema = z.object({
  username: z.string().min(3).max(50),
  email: z.string().email(),
  password: z.string().min(8).max(100),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

/**
 * POST /api/auth/register
 * Register a new user account
 */
router.post("/register", async (req: Request, res: Response) => {
  try {
    // Validate request body
    const validatedData = registerSchema.parse(req.body);
    
    // Check if user already exists
    const existingUser = await storage.getUserByEmail(validatedData.email);
    if (existingUser) {
      return res.status(409).json({
        error: "User with this email already exists",
      });
    }

    const existingUsername = await storage.getUserByUsername(validatedData.username);
    if (existingUsername) {
      return res.status(409).json({
        error: "Username already taken",
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(validatedData.password, SALT_ROUNDS);

    // Create user
    const user = await storage.createUser({
      username: validatedData.username,
      email: validatedData.email,
      password: passwordHash,
      firstName: validatedData.firstName,
      lastName: validatedData.lastName,
    });

    // Generate JWT token
    const token = generateToken({
      id: user.id,
      email: user.email,
      username: user.username,
    });

    logger.info(`New user registered: ${user.email}`);

    // Return user (without password) and token
    const { password: _, ...userWithoutPassword } = user;
    
    res.status(201).json({
      user: userWithoutPassword,
      token,
      message: "Registration successful",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Validation failed",
        details: error.errors,
      });
    }

    logger.error("Registration error:", error);
    res.status(500).json({
      error: "Registration failed",
    });
  }
});

/**
 * POST /api/auth/login
 * Authenticate user and return JWT token
 */
router.post("/login", async (req: Request, res: Response) => {
  try {
    // Validate request body
    const { email, password } = loginSchema.parse(req.body);

    // Find user by email
    const user = await storage.getUserByEmail(email);
    if (!user) {
      return res.status(401).json({
        error: "Invalid email or password",
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({
        error: "Invalid email or password",
      });
    }

    // Generate JWT token
    const token = generateToken({
      id: user.id,
      email: user.email,
      username: user.username,
    });

    logger.info(`User logged in: ${user.email}`);

    // Return user (without password) and token
    const { password: _, ...userWithoutPassword } = user;
    
    res.status(200).json({
      user: userWithoutPassword,
      token,
      message: "Login successful",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Validation failed",
        details: error.errors,
      });
    }

    logger.error("Login error:", error);
    res.status(500).json({
      error: "Login failed",
    });
  }
});

/**
 * GET /api/auth/me
 * Get current authenticated user
 */
router.get("/me", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: "Not authenticated",
      });
    }

    const user = await storage.getUser(req.user.id);
    if (!user) {
      return res.status(404).json({
        error: "User not found",
      });
    }

    const { password: _, ...userWithoutPassword } = user;
    res.status(200).json({ user: userWithoutPassword });
  } catch (error) {
    logger.error("Get current user error:", error);
    res.status(500).json({
      error: "Failed to get user",
    });
  }
});

/**
 * POST /api/auth/refresh
 * Refresh JWT token
 */
router.post("/refresh", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: "Not authenticated",
      });
    }

    // Generate new token
    const token = generateToken({
      id: req.user.id,
      email: req.user.email,
      username: req.user.username,
    });

    res.status(200).json({
      token,
      message: "Token refreshed successfully",
    });
  } catch (error) {
    logger.error("Token refresh error:", error);
    res.status(500).json({
      error: "Token refresh failed",
    });
  }
});

export default router;
