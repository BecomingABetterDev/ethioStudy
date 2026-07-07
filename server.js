require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const path = require("path");

const connectDB = require("./server/config/database");
const errorHandler = require("./server/middleware/errorHandler");

const authRoutes = require("./server/routes/auth");
const taskRoutes = require("./server/routes/tasks");
const sessionRoutes = require("./server/routes/sessions");
const dashboardRoutes = require("./server/routes/dashboard");

// Connect to MongoDB
connectDB();

const app = express();

// ─── Security Middleware ────────────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://fonts.googleapis.com",
        ],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://fonts.googleapis.com",
          "https://fonts.gstatic.com",
        ],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        connectSrc: [
          "'self'",
          "https://fonts.googleapis.com",
          "https://fonts.gstatic.com",
        ],
        workerSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "blob:"],
        manifestSrc: ["'self'"], // Allows the PWA manifest.json file to load securely
      },
    },
  })
);

// ─── CORS Configuration ─────────────────────────────────────────────
const allowedOrigins = [
  "https://ethiostudy.onrender.com", // Your production backend/frontend domain
  "http://localhost:5000",
  "http://localhost:3000", // Alternative local development port
  "https://eyob-dportfolio.vercel.app",
];

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps, Postman, or server-to-server curl requests)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(
          new Error("Blocked by security: Request origin not allowed by CORS")
        );
      }
    },
    credentials: true, // Allows HTTP-only cookies or Authorization headers to pass securely if needed
    optionsSuccessStatus: 200, // Solves potential legacy browser caching bugs (IE11)
  })
);
// ─── Rate Limiting ──────────────────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  message: {
    success: false,
    message:
      "Too many authentication attempts from this IP, please try again after an hour.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: {
    success: false,
    message:
      "Too many requests from this IP, please try again after 15 minutes.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── General Middleware ─────────────────────────────────────────────────────
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));

// ─── Static Files (Frontend) ────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, "client")));

// ─── API Routes ─────────────────────────────────────────────────────────────
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/tasks", apiLimiter, taskRoutes);
app.use("/api/sessions", apiLimiter, sessionRoutes);
app.use("/api/dashboard", apiLimiter, dashboardRoutes);

// ─── Health Check ───────────────────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "EthioStudy API is running",
    environment: process.env.NODE_ENV || "development",
    timestamp: new Date().toISOString(),
  });
});

// ─── SPA Fallback ───────────────────────────────────────────────────────────
// Serve dashboard.html for protected routes
app.get("/dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "client", "dashboard.html"));
});
app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "client", "login.html"));
});
app.get("/register", (req, res) => {
  res.sendFile(path.join(__dirname, "client", "register.html"));
});

// ─── 404 Handler ────────────────────────────────────────────────────────────
app.use((req, res) => {
  if (req.path.startsWith("/api/")) {
    return res
      .status(404)
      .json({ success: false, message: "API endpoint not found" });
  }
  res.sendFile(path.join(__dirname, "client", "index.html"));
});

// ─── Global Error Handler ───────────────────────────────────────────────────
app.use(errorHandler);

// ─── Start Server ────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(
    `\n🚀 EthioStudy server running in ${
      process.env.NODE_ENV || "development"
    } mode`
  );
  console.log(`   Local: http://localhost:${PORT}\n`);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (err) => {
  console.error("Unhandled Promise Rejection:", err.message);
  server.close(() => process.exit(1));
});

module.exports = app;
