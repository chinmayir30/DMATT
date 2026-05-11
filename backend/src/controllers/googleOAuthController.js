// Google OAuth Controller
// Handles OAuth 2.0 authentication flow for Google APIs
// Phase 3 - Task 1: Google API Setup & Authentication

import { google } from 'googleapis';
import pool from '../config/database.js';

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// OAuth scopes required for Google APIs
const SCOPES = [
  'https://www.googleapis.com/auth/webmasters.readonly', // Search Console
  'https://www.googleapis.com/auth/analytics.readonly',  // Analytics
  'https://www.googleapis.com/auth/youtube.readonly',    // YouTube (Phase 5)
  'https://www.googleapis.com/auth/youtube.upload',      // YouTube uploads (publish videos)
];

/**
 * @route   GET /api/admin/google/oauth/authorize
 * @desc    Initiate Google OAuth flow
 * @access  Private (requires authentication)
 */
export const initiateOAuth = async (req, res) => {
  try {
    // Validate configuration early (avoid confusing Google "invalid_client" pages)
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (
      !clientId ||
      !clientSecret ||
      clientId.includes('your-client-id-here') ||
      clientSecret.includes('your-client-secret-here')
    ) {
      return res.status(503).json({
        success: false,
        message: 'Google integration not configured',
        error:
          'Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in backend/.env using credentials from Google Cloud Console.',
      });
    }

    // Generate OAuth URL
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline', // Get refresh token
      scope: SCOPES,
      prompt: 'consent', // Force consent screen to get refresh token
      state: req.user.id.toString(), // Pass user ID for callback
    });

    res.json({
      success: true,
      data: {
        authUrl,
      },
    });
  } catch (error) {
    console.error('OAuth initiation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to initiate Google OAuth',
      error: error.message,
    });
  }
};

/**
 * @route   GET /api/admin/google/oauth/callback
 * @desc    Handle OAuth callback and store tokens
 * @access  Public (called by Google)
 */
export const handleOAuthCallback = async (req, res) => {
  try {
    const { code, state } = req.query;

    if (!code) {
      return res.status(400).send('Authorization code not provided');
    }

    const userId = parseInt(state);

    if (!userId) {
      return res.status(400).send('Invalid state parameter');
    }

    // Exchange authorization code for tokens
    const { tokens } = await oauth2Client.getToken(code);

    // Store tokens in database
    const query = `
      INSERT INTO google_credentials
        (user_id, access_token, refresh_token, token_expiry, scope, updated_at)
      VALUES
        ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT (user_id)
      DO UPDATE SET
        access_token = EXCLUDED.access_token,
        refresh_token = EXCLUDED.refresh_token,
        token_expiry = EXCLUDED.token_expiry,
        scope = EXCLUDED.scope,
        updated_at = NOW()
      RETURNING id
    `;

    const tokenExpiry = new Date(tokens.expiry_date);
    const scope = SCOPES.join(' ');

    await pool.query(query, [
      userId,
      tokens.access_token,
      tokens.refresh_token,
      tokenExpiry,
      scope,
    ]);

    // Redirect to frontend with success message
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Google OAuth Success</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          }
          .container {
            background: white;
            padding: 40px;
            border-radius: 12px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
            text-align: center;
            max-width: 400px;
          }
          .success-icon {
            font-size: 60px;
            color: #4caf50;
            margin-bottom: 20px;
          }
          h1 {
            color: #333;
            margin: 0 0 10px 0;
            font-size: 24px;
          }
          p {
            color: #666;
            margin: 10px 0 30px 0;
            line-height: 1.5;
          }
          button {
            background: #667eea;
            color: white;
            border: none;
            padding: 12px 30px;
            border-radius: 6px;
            font-size: 16px;
            cursor: pointer;
            transition: background 0.3s;
          }
          button:hover {
            background: #5568d3;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="success-icon">✓</div>
          <h1>Google Account Connected!</h1>
          <p>Your Google account has been successfully connected to DMAT. You can now access Search Console, Analytics, and YouTube features (including uploads if enabled on your account).</p>
          <button onclick="window.close()">Close Window</button>
        </div>
        <script>
          // Auto-close window after 3 seconds
          setTimeout(() => {
            window.close();
          }, 3000);
        </script>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Google OAuth Error</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
          }
          .container {
            background: white;
            padding: 40px;
            border-radius: 12px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
            text-align: center;
            max-width: 400px;
          }
          .error-icon {
            font-size: 60px;
            color: #f44336;
            margin-bottom: 20px;
          }
          h1 {
            color: #333;
            margin: 0 0 10px 0;
            font-size: 24px;
          }
          p {
            color: #666;
            margin: 10px 0 30px 0;
            line-height: 1.5;
          }
          .error-details {
            background: #f5f5f5;
            padding: 15px;
            border-radius: 6px;
            margin: 20px 0;
            font-size: 14px;
            color: #d32f2f;
            word-break: break-word;
          }
          button {
            background: #f44336;
            color: white;
            border: none;
            padding: 12px 30px;
            border-radius: 6px;
            font-size: 16px;
            cursor: pointer;
            transition: background 0.3s;
          }
          button:hover {
            background: #d32f2f;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="error-icon">✗</div>
          <h1>Connection Failed</h1>
          <p>There was an error connecting your Google account. Please try again.</p>
          <div class="error-details">${error.message}</div>
          <button onclick="window.close()">Close Window</button>
        </div>
      </body>
      </html>
    `);
  }
};

/**
 * @route   GET /api/admin/google/oauth/status
 * @desc    Check if user has connected Google account
 * @access  Private (requires authentication)
 */
export const checkOAuthStatus = async (req, res) => {
  try {
    const query = `
      SELECT
        id,
        token_expiry,
        scope,
        created_at,
        updated_at
      FROM google_credentials
      WHERE user_id = $1
    `;

    const result = await pool.query(query, [req.user.id]);

    if (result.rows.length === 0) {
      return res.json({
        success: true,
        data: {
          connected: false,
        },
      });
    }

    const credential = result.rows[0];
    const isExpired = new Date(credential.token_expiry) < new Date();

    res.json({
      success: true,
      data: {
        connected: true,
        tokenExpiry: credential.token_expiry,
        isExpired,
        scope: credential.scope,
        connectedAt: credential.created_at,
        lastUpdated: credential.updated_at,
      },
    });
  } catch (error) {
    console.error('OAuth status check error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check OAuth status',
      error: error.message,
    });
  }
};

/**
 * @route   DELETE /api/admin/google/oauth/disconnect
 * @desc    Disconnect Google account (delete tokens)
 * @access  Private (requires authentication)
 */
export const disconnectGoogle = async (req, res) => {
  try {
    const query = 'DELETE FROM google_credentials WHERE user_id = $1 RETURNING id';
    const result = await pool.query(query, [req.user.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No Google account connected',
      });
    }

    res.json({
      success: true,
      message: 'Google account disconnected successfully',
    });
  } catch (error) {
    console.error('OAuth disconnect error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to disconnect Google account',
      error: error.message,
    });
  }
};
