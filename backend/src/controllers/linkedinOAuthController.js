// LinkedIn OAuth Controller
// Handles LinkedIn OAuth 2.0 authentication flow

import crypto from 'crypto';
import * as linkedinService from '../services/linkedinService.js';

// Store for OAuth states (in production, use Redis)
const oauthStates = new Map();

/**
 * Initiate LinkedIn OAuth flow
 * GET /api/admin/linkedin/oauth/authorize
 */
export const initiateOAuth = async (req, res) => {
  try {
    // Check if LinkedIn is configured
    if (!process.env.LINKEDIN_CLIENT_ID || !process.env.LINKEDIN_CLIENT_SECRET) {
      return res.status(503).json({
        error: 'LinkedIn integration not configured',
        message: 'Please configure LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET in .env'
      });
    }

    // Generate random state for CSRF protection
    const state = crypto.randomBytes(32).toString('hex');

    // Store state with user ID (expires in 10 minutes)
    oauthStates.set(state, {
      userId: req.user.id,
      timestamp: Date.now()
    });

    // Clean up expired states
    for (const [key, value] of oauthStates.entries()) {
      if (Date.now() - value.timestamp > 600000) { // 10 minutes
        oauthStates.delete(key);
      }
    }

    // Generate authorization URL
    const authUrl = linkedinService.getAuthorizationUrl(state);

    res.json({
      authorizationUrl: authUrl
    });
  } catch (error) {
    console.error('Error initiating OAuth:', error);
    res.status(500).json({
      error: 'Failed to initiate OAuth flow',
      message: error.message
    });
  }
};

/**
 * Handle LinkedIn OAuth callback
 * GET /api/admin/linkedin/oauth/callback
 */
export const handleOAuthCallback = async (req, res) => {
  try {
    const { code, state, error, error_description } = req.query;

    // Handle authorization errors
    if (error) {
      console.error('LinkedIn OAuth error:', error, error_description);
      return res.redirect(
        `${process.env.CORS_ORIGIN}/linkedin?error=${encodeURIComponent(error_description || error)}`
      );
    }

    // Validate state
    const stateData = oauthStates.get(state);
    if (!stateData) {
      return res.redirect(
        `${process.env.CORS_ORIGIN}/linkedin?error=Invalid+state+parameter`
      );
    }

    // Clean up used state
    oauthStates.delete(state);

    // Exchange code for access token
    const tokenData = await linkedinService.exchangeCodeForToken(code);

    // Get user profile
    const profileData = await linkedinService.getUserProfile(tokenData.access_token);

    // Store tokens in database
    await linkedinService.storeTokens(stateData.userId, tokenData, profileData);

    // Redirect back to frontend
    res.redirect(`${process.env.CORS_ORIGIN}/linkedin?success=true`);
  } catch (error) {
    console.error('Error in OAuth callback:', error);
    res.redirect(
      `${process.env.CORS_ORIGIN}/linkedin?error=${encodeURIComponent(error.message)}`
    );
  }
};

/**
 * Get LinkedIn connection status
 * GET /api/admin/linkedin/status
 */
export const getConnectionStatus = async (req, res) => {
  try {
    const tokens = await linkedinService.getTokens(req.user.id);

    if (!tokens) {
      return res.json({
        connected: false
      });
    }

    // Check if token is expired
    const isExpired = linkedinService.isTokenExpired(tokens.expires_at);
    let linkedinUserName = tokens.linkedin_user_name;
    let linkedinUserEmail = tokens.linkedin_user_email;

    if (!linkedinUserEmail) {
      try {
        const profileData = await linkedinService.getUserProfile(tokens.access_token);
        await linkedinService.updateStoredProfile(req.user.id, profileData);
        linkedinUserName = profileData.linkedinUserName || linkedinUserName;
        linkedinUserEmail = profileData.linkedinUserEmail || linkedinUserEmail;
      } catch (profileError) {
        console.warn('Failed to refresh LinkedIn profile for status:', profileError.message);
      }
    }

    res.json({
      connected: true,
      expired: isExpired,
      linkedinUserName,
      linkedinUserEmail,
      connectedAt: tokens.created_at
    });
  } catch (error) {
    console.error('Error getting connection status:', error);
    res.status(500).json({
      error: 'Failed to get connection status',
      message: error.message
    });
  }
};

/**
 * Disconnect LinkedIn account
 * POST /api/admin/linkedin/disconnect
 */
export const disconnectLinkedIn = async (req, res) => {
  try {
    await linkedinService.deleteTokens(req.user.id);

    res.json({
      success: true,
      message: 'LinkedIn account disconnected successfully'
    });
  } catch (error) {
    console.error('Error disconnecting LinkedIn:', error);
    res.status(500).json({
      error: 'Failed to disconnect LinkedIn account',
      message: error.message
    });
  }
};
