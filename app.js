import express from "express";
import session from "express-session";
import sessionFileStoreFactory from "session-file-store";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import flash from "connect-flash";
import expressLayouts from "express-ejs-layouts";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

import { env } from "./config/env.js";
import jobRoutes from "./routes/job.routes.js";
import authRoutes from "./routes/auth.routes.js";
import recruiterRoutes from "./routes/recruiter.routes.js";
import { renderHome } from "./controllers/home.controller.js";
import { attachCsrfToken } from "./middleware/csrf.js";
import { notFoundHandler, errorHandler } from "./middleware/errorHandler.js";
import { colorForName, initialsFor, timeAgo, daysUntil, formatDate } from "./utils/viewHelpers.js";
import { icon } from "./utils/icons.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sessionsDir = path.join(__dirname, "sessions");
fs.mkdirSync(sessionsDir, { recursive: true });

const FileStore = sessionFileStoreFactory(session);
const app = express();

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
// Behind a reverse proxy (Heroku/Render/Nginx) so secure cookies + rate
// limiting see the real client, not the proxy hop.
app.set("trust proxy", 1);

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
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(
  session({
    store: new FileStore({ path: sessionsDir }),
    secret: env.sessionSecret,
    resave: false,
    saveUninitialized: false,
    name: "sid",
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: env.isProd || env.forceSecureCookies,
      maxAge: 24 * 60 * 60 * 1000, // 1 day
    },
  })
);

app.use(flash());
app.use(attachCsrfToken);

// Shared view locals for every request.
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.lastVisit = req.cookies.lastVisit || null;
  res.locals.messages = req.flash();
  res.locals.maxUploadSizeMb = env.upload.maxSizeMb;
  res.locals.currentPath = req.path;

  // View-layer formatting helpers (kept tiny/dependency-free for this app's scale).
  res.locals.colorForName = colorForName;
  res.locals.initialsFor = initialsFor;
  res.locals.timeAgo = timeAgo;
  res.locals.daysUntil = daysUntil;
  res.locals.formatDate = formatDate;
  res.locals.icon = icon;

  if (req.session.user) {
    res.cookie("lastVisit", new Date().toLocaleString());
  }

  next();
});

// Routes
app.use("/", authRoutes);
app.use("/jobs", jobRoutes);
app.use("/recruiter", recruiterRoutes);

app.get("/", renderHome);

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(env.port, () => {
  console.log(`✅ Server running on http://localhost:${env.port} [${env.nodeEnv}]`);
});
