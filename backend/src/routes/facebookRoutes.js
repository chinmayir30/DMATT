import express from "express";
import { authenticate } from "../middleware/auth.js";
import * as facebookOAuthController from "../controllers/facebookOAuthController.js";
import * as facebookPostController from "../controllers/facebookPostController.js";
import multer from 'multer';
import os from 'os';
import path from 'path';
import fs from 'fs';

const router = express.Router();
const FRONTEND_URL = (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',')[0];


// Configure multer for file uploads
const uploadDir = path.join(os.tmpdir(), 'dmat-facebook-uploads');
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      fs.mkdirSync(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const safe = `${Date.now()}-${file.originalname}`.replace(/[^\w.\- ]+/g, '_');
    cb(null, safe);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB for videos
});

import passport from 'passport';

// Redirect to frontend on success matching the original behavior
router.get('/oauth/callback', passport.authenticate('facebook', { session: false, failureRedirect: `${FRONTEND_URL}/facebook?error=Authentication+failed` }), (req, res) => {
  res.redirect(`${FRONTEND_URL}/facebook?success=true`);
});

// ✅ FACEBOOK FEATURES
router.post("/posts", authenticate, (req, res, next) => {
  upload.single('media')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
          error: 'File too large',
          message: 'Maximum file size is 500MB'
        });
      }
    }
    if (err) return next(err);
    next();
  });
}, facebookPostController.publishPost);
router.get("/pages", authenticate, facebookPostController.getPages);
router.post("/sync-pages", authenticate, facebookOAuthController.syncPages);
router.get("/posts", authenticate, facebookPostController.getPosts);
router.get("/status", authenticate, facebookPostController.getStatus);
router.get("/stats", authenticate, facebookPostController.getStats);
router.get("/diagnostics", authenticate, facebookPostController.getDiagnostics);
// Disconnect Facebook (delete stored tokens/pages)
router.post(
  "/disconnect",
  authenticate,
  facebookOAuthController.disconnectFacebook,
);

export default router;
