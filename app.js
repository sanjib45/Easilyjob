import express from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import expressLayouts from "express-ejs-layouts";
import path from "path";
import fs from "fs";
import { fileURLToPath, pathToFileURL } from "url";

import { env } from "./config/env.js";
import routes from "./routes/index.js";
import { renderHome } from "./controllers/home.controller.js";
import { prisma } from "./config/prisma.js";
import { attachCsrfToken } from "./middleware/csrf.js";
import { authenticate } from "./middleware/auth.js";
import { flashMiddleware } from "./middleware/flash.js";
import { notFoundHandler, errorHandler } from "./middleware/errorHandler.js";
import { colorForName, initialsFor, timeAgo, daysUntil, formatDate, formatSalary } from "./utils/viewHelpers.js";
import { icon } from "./utils/icons.js";

import http from "http";
import { initSocket } from "./config/socket.js";
import { attachShell } from "./middleware/shell.js";
import healthRoutes from "./routes/health.routes.js";
import { startOutboxWorker, stopOutboxWorker } from "./workers/email-worker.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
// Behind a reverse proxy (Heroku/Render/Nginx) so secure cookies + rate
// limiting see the real client, not the proxy hop.
app.set("trust proxy", env.trustProxy);

app.use(expressLayouts);
app.use(
  helmet({
    // Disabled because views don't use a CDN/nonce setup yet; revisit if
    // adding third-party scripts/styles.
    contentSecurityPolicy: false,
  })
);
app.use(compression());
app.use(morgan(env.isProd ? "combined" : "dev"));

app.use(express.static(path.join(__dirname, "public")));

// Health routes are mounted before body parsing/auth so probes stay lightweight.
app.use("/health", healthRoutes);

app.use(express.json({ limit: env.requestBodyLimit }));
app.use(express.urlencoded({ extended: true, limit: env.requestBodyLimit }));
app.use(cookieParser());
app.use(flashMiddleware);
app.use(authenticate);
app.use(attachCsrfToken);
app.use(attachShell);

// Shared view locals for every request.
app.use((req, res, next) => {
  res.locals.user = req.user || null;
  res.locals.lastVisit = req.cookies.lastVisit || null;
  res.locals.maxUploadSizeMb = env.upload.maxSizeMb;
  res.locals.currentPath = req.path;
  // Theme engine state (dark default, saved in cookie & localStorage)
  const theme = req.cookies.theme || "dark";
  res.locals.currentTheme = theme;

  // Use role-specific workspace sidebar shells consistently across all pages
  if (req.user) {
    const roleUpper = String(req.user.role || "").toUpperCase();
    if (roleUpper === "RECRUITER") {
      res.locals.layout = "layouts/recruiter";
    } else if (roleUpper === "APPLICANT") {
      res.locals.layout = "layouts/applicant";
    }
  }

  // View-layer formatting helpers (kept tiny/dependency-free for this app's scale).
  res.locals.colorForName = colorForName;
  res.locals.initialsFor = initialsFor;
  res.locals.timeAgo = timeAgo;
  res.locals.daysUntil = daysUntil;
  res.locals.formatDate = formatDate;
  res.locals.formatSalary = formatSalary;
  res.locals.icon = icon;

  if (req.user) {
    res.cookie("lastVisit", new Date().toLocaleString());
  }

  next();
});

// Routes — single mount point; see routes/index.js for the tree.
app.use(routes);

app.get("/", renderHome);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const startServer = async () => {
    try {
      await prisma.$connect();
      await prisma.$runCommandRaw({ ping: 1 });
      console.log("✅ MongoDB connected");
      startOutboxWorker();
      console.log("✅ Email outbox retry worker started");
      const server = http.createServer(app);
      initSocket(server);
      server.listen(env.port, () => {
        console.log(`✅ Server running on http://localhost:${env.port} [${env.nodeEnv}]`);
      });
      const shutdown = async (signal) => {
        console.log(`${signal} received. Shutting down gracefully.`);
        stopOutboxWorker();
        server.close(async () => {
          await prisma.$disconnect();
          process.exit(0);
        });
      };
      process.once("SIGINT", () => shutdown("SIGINT"));
      process.once("SIGTERM", () => shutdown("SIGTERM"));
    } catch (error) {
      console.error("❌ MongoDB connection failed:", error.message);
      process.exitCode = 1;
    }
  };

  startServer();
}
