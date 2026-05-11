import express from 'express';
import passport from 'passport';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();
const FRONTEND_URL = (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',')[0];


// Middleware to store userId in session before redirecting
const storeUserInSession = (req, res, next) => {
  if (req.user && req.user.id) {
    req.session.userId = req.user.id;
  }
  next();
};

const sendPopupResponse = (res, success, message) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${success ? 'Connected' : 'Error'}</title>
      <style>
        body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; background: #f9f9f9; }
        .container { text-align: center; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
      </style>
    </head>
    <body>
      <div class="container">
        <h1 style="color: ${success ? 'green' : 'red'};">${success ? 'Connected Successfully!' : 'Connection Failed'}</h1>
        <p>${message}</p>
        <p>This window will close automatically...</p>
      </div>
      <script>
        setTimeout(() => {
          window.close();
        }, 2000);
      </script>
    </body>
    </html>
  `);
};

// ========================
// FACEBOOK
// ========================
router.get('/facebook', authenticate, storeUserInSession, passport.authenticate('facebook', { 
  scope: ['pages_show_list', 'pages_read_engagement', 'pages_manage_posts', 'public_profile', 'email'] 
}));

router.get('/facebook/callback', passport.authenticate('facebook', { session: false, failureRedirect: `${FRONTEND_URL}/facebook?error=Authentication+failed` }), (req, res) => {
  res.redirect(`${FRONTEND_URL}/facebook?success=true`);
});

// ========================
// GOOGLE (YOUTUBE)
// ========================
router.get('/google', authenticate, storeUserInSession, passport.authenticate('google', { 
  scope: [
    "https://www.googleapis.com/auth/youtube.upload",
    "https://www.googleapis.com/auth/youtube.readonly",
    "profile", "email"
  ],
  accessType: 'offline',
  prompt: 'consent select_account'
}));

router.get('/google/callback', passport.authenticate('google', { session: false, failureRedirect: `${FRONTEND_URL}/youtube?error=Authentication+failed` }), (req, res) => {
  res.redirect(`${FRONTEND_URL}/youtube?success=true`);
});

// ========================
// LINKEDIN
// ========================
router.get('/linkedin', authenticate, storeUserInSession, passport.authenticate('linkedin', { 
  scope: ['w_member_social', 'openid', 'profile', 'email'] 
}));

router.get('/linkedin/callback', passport.authenticate('linkedin', { session: false, failureRedirect: `${FRONTEND_URL}/linkedin?error=Authentication+failed` }), (req, res) => {
  res.redirect(`${FRONTEND_URL}/linkedin?success=true`);
});

// ========================
// FAILURE ENDPOINT
// ========================
router.get('/social/failed', (req, res) => {
  sendPopupResponse(res, false, 'Authentication failed or was denied.');
});

export default router;
