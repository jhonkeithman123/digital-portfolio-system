import express from "express";
import path from "path";
import { Server } from "http";
import { fileURLToPath } from "url";
import cookieParser from "cookie-parser";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import activities from "./routes/activities.js";
import auth from "./routes/auth.js";
import classrooms from "./routes/classrooms.js";
import mainRoute from "./routes/default.js";
import portfolioRoute from "./routes/portfolio.js";
import security from "./routes/security.js";
import showcase from "./routes/showcase.js";
import supabaseRoute from "./routes/supabase.js";
import uploadStatic from "./routes/uploads.js";

import { checkDbAvailability, requireDb } from "./middleware/dbCheck.js";
import {
  browserHtmlRedirectGuard,
  createSafeRedirectHandler,
  renderLandingPage,
} from "./middleware/http/browserGuards.js";
import {
  createCorsPolicy,
  DEFAULT_CLIENT_ORIGIN,
  resolvePrimaryClientOrigin,
} from "./middleware/http/corsPolicy.js";
import {
  requestDebugLogger,
  requestLogger,
} from "./middleware/http/requestLogger.js";
import { normalizeTokenSource } from "./middleware/http/tokenNormalization.js";
import { pingSupabaseConnection } from "./supabase/ping.js";
import { loadEnv } from "./config/loadEnv.js";
import db from "./config/db.js";

loadEnv();

const app = express();
app.set("trust proxy", 1);
const supabaseOnly = db.isSupabaseOnlyMode();

const clientUrl = resolvePrimaryClientOrigin(
  process.env.CLIENT_ORIGIN || DEFAULT_CLIENT_ORIGIN,
);

app.use(createCorsPolicy(clientUrl));

// ============================================================================
// MIDDLEWARE
// ============================================================================

// Static files
app.use(express.static(path.join(__dirname, "public")));

// Request logging
app.use(requestLogger);

app.use(express.json());
app.use(cookieParser());

app.use(requestDebugLogger);

// Normalize token sources for authentication
app.use(normalizeTokenSource);

if (!supabaseOnly) {
  app.use(checkDbAvailability);
}

// ============================================================================
// ROUTES
// ============================================================================

// Landing page for browser visits
app.get(
  "/",
  renderLandingPage(
    path.join(__dirname, "public"),
    clientUrl,
    "https://github.com/jhonkeithman123/digital-portfolio-system-client/blob/main/For_Client.md",
    process.env.ACCENT_COLOR || "#007bff",
  ),
);

if (supabaseOnly) {
  app.use("/auth", auth);
  app.use("/uploads", uploadStatic);
  app.use("/activity", activities);
  app.use("/classrooms", classrooms);
  app.use("/portfolio", portfolioRoute);
  app.use("/security", security);
  app.use("/", mainRoute);
} else {
  app.use("/uploads", requireDb, uploadStatic);

  // API routes
  app.use("/", requireDb, mainRoute);
  app.use("/activity", requireDb, activities);
  app.use("/auth", requireDb, auth);
  app.use("/classrooms", requireDb, classrooms);
  app.use("/portfolio", requireDb, portfolioRoute);
  app.use("/security", requireDb, security);
}
app.use("/supabase", supabaseRoute);

// ============================================================================
// BROWSER REDIRECT MIDDLEWARE (must be AFTER API routes)
// ============================================================================

/**
 * Redirect all browser HTML requests back to root
 * This prevents users from accessing API endpoints via browser URL bar
 */
app.use(browserHtmlRedirectGuard);

// ============================================================================
// EXTERNAL REDIRECT HANDLER
// ============================================================================

/**
 * Safe redirect endpoint for external links from the landing page
 * Usage: <a href="/redirect?url=https://github.com/...">
 */
app.get("/redirect", createSafeRedirectHandler(clientUrl));

// ============================================================================
// ERROR HANDLING
// ============================================================================

// Global error handler
app.use(
  (err: Error, req: any, res: any, next: (err?: unknown) => void): void => {
    console.error(
      `[UNHANDLED ERROR] ${new Date().toISOString()} ${req.method} ${
        req.originalUrl
      }`,
      err?.stack || err,
    );

    if (!res.headersSent) {
      res.status(500).json({ error: "Internal Server Error" });
    } else {
      next(err);
    }
  },
);

const isVercelRuntime = process.env.VERCEL === "1";

// Process-level error handlers (standalone server only)
if (!isVercelRuntime) {
  process.on("unhandledRejection", (reason: unknown) => {
    console.error("[UNHANDLED REJECTION]", reason);
  });

  process.on("uncaughtException", (err: Error) => {
    console.error("[UNCAUGHT EXCEPTION]", err);
    process.exit(1);
  });
}

// ============================================================================
// SERVER STARTUP
// ============================================================================

const DEFAULT_PORT = parseInt(process.env.PORT ?? "5000", 10);
const MAX_ATTEMPTS = 10;

function tryListen(port: number, attemptsLeft: number) {
  const server: Server = app.listen(port);

  server.on("listening", () => {
    console.log(`✅ Server listening on port ${port}`);
    console.log(`📍 Environment: ${process.env.NODE_ENV || "development"}`);
    console.log(`🔗 Client URL: ${clientUrl}`);
    console.log(`🗄️ DB Provider: ${supabaseOnly ? "supabase" : "mysql"}`);

    void pingSupabaseConnection().then((result) => {
      const log = result.ok ? console.log : console.warn;
      log(`🧪 ${result.message}`);
    });
  });

  server.on("error", (err: NodeJS.ErrnoException) => {
    if (err?.code === "EADDRINUSE") {
      console.warn(`⚠️  Port ${port} is already in use.`);

      try {
        server.close();
      } catch (e) {
        // Ignore close errors
      }

      if (attemptsLeft > 0) {
        const nextPort = port + 1;
        console.log(
          `🔄 Trying port ${nextPort} (${attemptsLeft - 1} attempts remaining)`,
        );
        tryListen(nextPort, attemptsLeft - 1);
      } else {
        console.error(
          `❌ No available ports after ${MAX_ATTEMPTS} attempts. Exiting.`,
        );
        process.exit(1);
      }
    } else {
      console.error("❌ Server error:", err);
      process.exit(1);
    }
  });
}

if (!isVercelRuntime) {
  tryListen(DEFAULT_PORT, MAX_ATTEMPTS);
}

export default app;
