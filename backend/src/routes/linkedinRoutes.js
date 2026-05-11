// LinkedIn Routes
// OAuth and post publishing routes

import express from 'express';
import { authenticate } from '../middleware/auth.js';
import * as linkedinOAuthController from '../controllers/linkedinOAuthController.js';
import * as linkedinPostController from '../controllers/linkedinPostController.js';
import multer from 'multer';
import os from 'os';
import path from 'path';
import fs from 'fs';

const router = express.Router();
const FRONTEND_URL = (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',')[0];


// Configure multer for file uploads
const uploadDir = path.join(os.tmpdir(), 'dmat-linkedin-uploads');
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

// ============================================================================
// Error Handling Middleware for Multer
// ============================================================================

const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        error: 'File too large',
        message: 'Maximum file size is 500MB'
      });
    }
  }
  next(err);
};

// ============================================================================
// OAuth Routes
// ============================================================================

import passport from 'passport';

// Redirect to frontend on success matching the original behavior
router.get('/oauth/callback', passport.authenticate('linkedin', { session: false, failureRedirect: `${FRONTEND_URL}/linkedin?error=Authentication+failed` }), (req, res) => {
  res.redirect(`${FRONTEND_URL}/linkedin?success=true`);
});

// Get connection status
router.get('/status', authenticate, linkedinOAuthController.getConnectionStatus);

// Disconnect LinkedIn account
router.post('/disconnect', authenticate, linkedinOAuthController.disconnectLinkedIn);

// ============================================================================
// Post Routes (all require authentication)
// ============================================================================

// Publish a new post with error handler
router.post('/posts', authenticate, (req, res, next) => {
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
}, linkedinPostController.publishPost);

// Get post history
router.get('/posts', authenticate, linkedinPostController.getPostHistory);

// Get post statistics
router.get('/stats', authenticate, linkedinPostController.getPostStats);

export default router;
