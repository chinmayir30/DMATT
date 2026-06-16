import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import session from "express-session";

dotenv.config(); // ✅ IMPORTANT

import healthRoutes from "./src/routes/healthRoutes.js";
import landingPageRoutes from "./src/routes/landingPageRoutes.js";
import leadRoutes from "./src/routes/leadRoutes.js";
import leadNoteRoutes from "./src/routes/leadNoteRoutes.js";
import userRoutes from "./src/routes/userRoutes.js";
import publicRoutes from "./src/routes/publicRoutes.js";
import authRoutes from "./src/routes/authRoutes.js";
import socialOAuthRoutes from "./src/routes/socialOAuthRoutes.js";
import passport from "./src/config/passport.js";
import analyticsRoutes from "./src/routes/analyticsRoutes.js";
import templateRoutes from "./src/routes/templateRoutes.js";
import uploadRoutes from "./src/routes/uploadRoutes.js";
import googleOAuthRoutes from "./src/routes/googleOAuthRoutes.js";
import searchConsoleRoutes from "./src/routes/searchConsoleRoutes.js";
import ga4Routes from "./src/routes/ga4Routes.js";
import integratedAnalyticsRoutes from "./src/routes/integratedAnalyticsRoutes.js";
import seoDashboardRoutes from "./src/routes/seoDashboardRoutes.js";
import linkedinRoutes from "./src/routes/linkedinRoutes.js";
import facebookRoutes from "./src/routes/facebookRoutes.js";
import youtubeRoutes from "./src/routes/youtubeRoutes.js";
import socialHubRoutes from "./src/routes/socialHubRoutes.js";
import scheduledPostRoutes from "./src/routes/scheduledPostRoutes.js";
import { initializeStorage } from "./src/services/storage.js";
import { startScheduledPostWorker } from "./src/services/scheduledPostWorker.js";

const app = express();
const PORT = process.env.PORT || 5001;

// ✅ CORS with credentials
const allowedOrigins = (
  process.env.CORS_ORIGIN || "dmatt.vercel.app"
).split(",");

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ SESSION (Required for YouTube OAuth)
app.use(
  session({
    name: "dmat-session",
    secret: process.env.SESSION_SECRET || "dev-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false,
      httpOnly: true,
      sameSite: "lax",
    },
  }),
);

// ✅ PASSPORT INITIALIZATION
app.use(passport.initialize());
app.use(passport.session());

// ✅ LOGGING
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// ✅ ROUTES
app.use("/api", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/social-oauth", socialOAuthRoutes);
app.use("/api/admin/landing-pages", landingPageRoutes);
app.use("/api/admin/leads", leadNoteRoutes);
app.use("/api/admin/leads", leadRoutes);
app.use("/api/admin/users", userRoutes);
app.use("/api/admin/analytics", analyticsRoutes);
app.use("/api/admin/templates", templateRoutes);
app.use("/api/admin/upload", uploadRoutes);
app.use("/api/admin/google/oauth", googleOAuthRoutes);
app.use("/api/admin/seo", searchConsoleRoutes);
app.use("/api/admin/ga4", ga4Routes);
app.use("/api/admin/integrated-analytics", integratedAnalyticsRoutes);
app.use("/api/admin/seo-dashboard", seoDashboardRoutes);
app.use("/api/admin/linkedin", linkedinRoutes);

// 🔥 SOCIAL MEDIA ROUTES
app.use("/api/admin/facebook", facebookRoutes);
app.use("/api/admin/youtube", youtubeRoutes);
app.use("/api/admin/social-hub", socialHubRoutes);
app.use("/api/admin/scheduled-posts", scheduledPostRoutes);

app.use("/api/public", publicRoutes);

// ✅ ROOT
app.get("/", (req, res) => {
  res.json({ message: "DMAT Backend Running 🚀" });
});

// ❌ 404
app.use((req, res) => {
  res.status(404).json({
    status: "error",
    message: "Route not found",
    path: req.path,
  });
});

// ❌ ERROR HANDLER
app.use((err, req, res, next) => {
  console.error("SERVER ERROR:", err);
  const statusCode = err.status || err.statusCode || 500;
  res.status(statusCode).json({
    status: "error",
    message: err.message || "Internal server error",
  });
});

// 🚀 START SERVER
app.listen(PORT, async () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);

  try {
    await initializeStorage();
    console.log("✅ Storage initialized");
  } catch (error) {
    console.warn("⚠️ Storage initialization failed:", error.message);
  }

  try {
    startScheduledPostWorker();
    console.log("✅ Scheduled Post Worker started");
  } catch (error) {
    console.warn("⚠️ Scheduled Post Worker failed:", error.message);
  }
});

export default app;
