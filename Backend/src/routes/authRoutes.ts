import { Router } from "express";
import { userRepository } from "../db/repositories/userRepository";
import { signJwt } from "../middleware/auth";
import type { Role } from "../middleware/auth";
import { v4 as uuidv4 } from "uuid";

export const authRouter = Router();

// ---------------------------------------------------------------------------
// GET /check-email
// ---------------------------------------------------------------------------
authRouter.get("/check-email", (req, res) => {
  try {
    const email = req.query.email as string;
    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const existingUser = userRepository.findByEmail(email.toLowerCase());
    return res.json({ available: !existingUser });
  } catch (error) {
    console.error("Error checking email:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// POST /register
// ---------------------------------------------------------------------------
authRouter.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const normalizedEmail = email.toLowerCase();
    
    // Check if email already in use
    const existingUser = userRepository.findByEmail(normalizedEmail);
    if (existingUser) {
      return res.status(409).json({ error: "Email is already registered" });
    }

    // Hash the password
    const password_hash = await Bun.password.hash(password);
    
    // Create new user (Assign default 'user' role)
    const userId = uuidv4();
    // Default project ID for now, normally you'd create a project for them
    const projectId = uuidv4(); 
    
    userRepository.insert({
      id: userId,
      email: normalizedEmail,
      name,
      role: "user",
      project_id: projectId,
      password_hash,
      created_at: new Date().toISOString(),
    });

    // Create session token
    const token = signJwt({
      sub: userId,
      email: normalizedEmail,
      role: "user" as Role,
      projectId,
    });

    return res.status(201).json({
      token,
      name,
      email: normalizedEmail,
      role: "user",
      projectId,
    });
  } catch (error) {
    console.error("Registration error:", error);
    return res.status(500).json({ error: "Internal server error during registration" });
  }
});

// ---------------------------------------------------------------------------
// POST /login
// ---------------------------------------------------------------------------
authRouter.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const normalizedEmail = email.toLowerCase();
    const user = userRepository.findByEmail(normalizedEmail);

    if (!user || !user.password_hash) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const isMatch = await Bun.password.verify(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const token = signJwt({
      sub: user.id,
      email: user.email,
      role: user.role as Role,
      projectId: user.project_id,
    });

    return res.json({
      token,
      name: user.name,
      email: user.email,
      role: user.role,
      projectId: user.project_id,
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ error: "Internal server error during login" });
  }
});

// ---------------------------------------------------------------------------
// POST /google
// ---------------------------------------------------------------------------
authRouter.post("/google", async (req, res) => {
  try {
    const { accessToken } = req.body;
    if (!accessToken) {
      return res.status(400).json({ error: "Access token required" });
    }

    // Verify token & get user info directly from Google
    const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    
    if (!response.ok) {
      return res.status(401).json({ error: "Invalid Google token" });
    }
    
    const userInfo = await response.json() as { email?: string; name?: string };
    if (!userInfo.email) {
      return res.status(400).json({ error: "Could not retrieve email from Google" });
    }

    const normalizedEmail = userInfo.email.toLowerCase();
    let user = userRepository.findByEmail(normalizedEmail);

    // If user doesn't exist, seamlessly create them!
    if (!user) {
      const userId = crypto.randomUUID();
      const projectId = crypto.randomUUID();
      const dummyHash = await Bun.password.hash(crypto.randomUUID());
      
      userRepository.insert({
        id: userId,
        email: normalizedEmail,
        name: userInfo.name || "Google User",
        role: "user",
        project_id: projectId,
        password_hash: dummyHash,
        created_at: new Date().toISOString(),
      });
      
      user = userRepository.findByEmail(normalizedEmail)!;
    }

    // Generate our ThreatFlix JWT
    const token = signJwt({
      sub: user.id,
      email: user.email,
      role: user.role as Role,
      projectId: user.project_id,
    });

    return res.json({
      token,
      name: user.name,
      email: user.email,
      role: user.role,
      projectId: user.project_id,
    });
  } catch (error) {
    console.error("Google Auth error:", error);
    return res.status(500).json({ error: "Internal server error during Google auth" });
  }
});
