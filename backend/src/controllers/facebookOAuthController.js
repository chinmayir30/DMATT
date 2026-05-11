// Facebook OAuth Controller

import crypto from "crypto";
import * as facebookService from "../services/facebookService.js";

const oauthStates = new Map();

export const initiateOAuth = async (req, res) => {
  try {
    if (
      !process.env.FACEBOOK_CLIENT_ID ||
      !process.env.FACEBOOK_CLIENT_SECRET
    ) {
      return res.status(503).json({
        error: "Facebook integration not configured",
        message:
          "Please configure FACEBOOK_CLIENT_ID and FACEBOOK_CLIENT_SECRET in .env",
      });
    }

    const state = crypto.randomBytes(32).toString("hex");

    oauthStates.set(state, {
      userId: req.user.id,
      timestamp: Date.now(),
    });

    for (const [key, value] of oauthStates.entries()) {
      if (Date.now() - value.timestamp > 600000) {
        oauthStates.delete(key);
      }
    }

    const authUrl = facebookService.getAuthorizationUrl(state);

    res.json({ authorizationUrl: authUrl });
  } catch (error) {
    console.error("Error initiating Facebook OAuth:", error);
    res.status(500).json({
      error: "Failed to initiate OAuth flow",
      message: error.message,
    });
  }
};

export const handleOAuthCallback = async (req, res) => {
  try {
    const { code, state, error, error_description } = req.query;

    if (error) {
      const errorMsg = error_description || error;
      console.error('❌ Facebook OAuth Error:', errorMsg);
      
      // Provide helpful error message for redirect URI mismatch
      if (error === 'invalid_request' && errorMsg.includes('redirect')) {
        const helpMsg = `Invalid Redirect URI. Please configure this in Facebook Developer Console: ${process.env.FACEBOOK_REDIRECT_URI}`;
        return res.redirect(
          `${process.env.CORS_ORIGIN.split(',')[0]}/facebook?error=${encodeURIComponent(helpMsg)}`,
        );
      }
      
      return res.redirect(
        `${process.env.CORS_ORIGIN.split(',')[0]}/facebook?error=${encodeURIComponent(errorMsg)}`,
      );
    }

    const stateData = oauthStates.get(state);
    if (!stateData) {
      const corsOrigin = process.env.CORS_ORIGIN?.split(',')[0] || 'http://localhost:5173';
      return res.redirect(`${corsOrigin}/facebook?error=Invalid+state+parameter`);
    }

    oauthStates.delete(state);

    try {
      console.log('🔄 Exchanging Facebook OAuth code for token...');
      const shortToken = await facebookService.exchangeCodeForToken(code);

      console.log('🔄 Exchanging for long-lived token...');
      const longToken = await facebookService.exchangeForLongLivedToken(
        shortToken.access_token,
      );

      console.log('🔄 Fetching user profile (using long-lived token)...');
      const profile = await facebookService.getUserProfile(
        longToken.access_token,
      );

      // Try to fetch pages using long-lived token first. If none are returned,
      // attempt again using the original short-lived token (some FB tokens
      // behave differently regarding page access tokens).
      console.log('🔄 Fetching user pages (using long-lived token)...');
      let pages = [];
      try {
        pages = await facebookService.getUserPages(longToken.access_token);
        console.log('📄 Pages received (long-lived):', pages?.length || 0);
      } catch (pagesErr) {
        console.warn('⚠️ Error fetching pages with long-lived token:', pagesErr?.message || pagesErr);
      }

      if (!pages || pages.length === 0) {
        try {
          console.log('🔄 No pages returned with long-lived token — retrying with short-lived token...');
          const fallbackPages = await facebookService.getUserPages(shortToken.access_token);
          pages = fallbackPages || [];
          console.log('📄 Pages received (short-lived):', pages?.length || 0);
        } catch (fallbackErr) {
          console.warn('⚠️ Fallback pages fetch failed:', fallbackErr?.message || fallbackErr);
        }
      }

      console.log('💾 Storing tokens for user:', stateData.userId, 'Pages count:', pages?.length || 0);
      await facebookService.storeTokens(
        stateData.userId,
        longToken,
        profile,
        pages,
      );

      console.log('✅ Facebook connection successful!');
    } catch (tokenError) {
      console.error('❌ Token Exchange Error:', tokenError.message || tokenError);
      const corsOrigin = process.env.CORS_ORIGIN?.split(',')[0] || 'http://localhost:5173';
      return res.redirect(`${corsOrigin}/facebook?error=${encodeURIComponent(tokenError.message || 'Token exchange failed')}`);
    }

    const corsOrigin = process.env.CORS_ORIGIN?.split(',')[0] || 'http://localhost:5173';
    res.redirect(`${corsOrigin}/facebook?success=true`);
  } catch (error) {
    console.error("❌ Error in Facebook OAuth callback:", error);
    const corsOrigin = process.env.CORS_ORIGIN?.split(',')[0] || 'http://localhost:5173';
    res.redirect(`${corsOrigin}/facebook?error=${encodeURIComponent(error.message)}`);
  }
};

export const disconnectFacebook = async (req, res) => {
  try {
    await facebookService.deleteTokens(req.user.id);
    return res.json({
      success: true,
      message: "Facebook account disconnected successfully",
    });
  } catch (error) {
    console.error("Error disconnecting Facebook:", error);
    return res
      .status(500)
      .json({ success: false, error: "Failed to disconnect Facebook account" });
  }
};

export const syncPages = async (req, res) => {
  try {
    console.log('🔄 Syncing Facebook pages for user:', req.user.id);
    
    // Get stored tokens
    const tokens = await facebookService.getTokens(req.user.id);
    
    if (!tokens) {
      return res.status(400).json({
        error: 'Facebook not connected',
        message: 'Please connect your Facebook account first'
      });
    }
    
    // Fetch fresh pages from Facebook
    console.log('📄 Fetching pages from Facebook API...');
    const pages = await facebookService.getUserPages(tokens.access_token);
    console.log('📄 Pages fetched:', pages.length, pages);
    
    // Get profile for reference
    const profile = await facebookService.getUserProfile(tokens.access_token);
    
    // Store pages in database
    console.log('💾 Storing pages in database...');
    await facebookService.syncUserPages(req.user.id, pages);
    
    console.log('✅ Pages synced successfully! Count:', pages.length);
    
    return res.json({
      success: true,
      message: `Synced ${pages.length} Facebook pages`,
      pages: pages
    });
    
  } catch (error) {
    console.error('❌ Error syncing Facebook pages:', error.message);
    return res.status(500).json({
      error: 'Failed to sync Facebook pages',
      message: error.message
    });
  }
};
//new line
