import passport from 'passport';
import { Strategy as FacebookStrategy } from 'passport-facebook';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as LinkedInStrategy } from 'passport-linkedin-oauth2';
import pool from './database.js';

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((obj, done) => {
  done(null, obj);
});

// Helper to save token in DB
const saveToken = async (userId, provider, accessToken, refreshToken, profile) => {
  // Try to use a specific identifier if available, fallback to profile.id
  const accountId = profile.id;
  const accountName = profile.displayName || profile.username || profile.name?.givenName || '';
  const accountEmail = profile.emails?.[0]?.value || profile._json?.email || '';

  await pool.query(
    `INSERT INTO social_accounts 
      (user_id, provider, access_token, refresh_token, provider_account_id, provider_account_name, provider_account_email, updated_at) 
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) 
     ON CONFLICT (user_id, provider) DO UPDATE SET 
      access_token = EXCLUDED.access_token, 
      refresh_token = COALESCE(EXCLUDED.refresh_token, social_accounts.refresh_token), 
      provider_account_id = EXCLUDED.provider_account_id,
      provider_account_name = EXCLUDED.provider_account_name,
      provider_account_email = EXCLUDED.provider_account_email,
      updated_at = NOW()`,
    [userId, provider, accessToken, refreshToken, accountId, accountName, accountEmail]
  );
};

// --- Facebook Strategy ---
if (process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET) {
  passport.use(new FacebookStrategy({
      clientID: process.env.FACEBOOK_CLIENT_ID,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
      callbackURL: process.env.FACEBOOK_REDIRECT_URI || 'http://localhost:5001/api/social-oauth/facebook/callback',
      passReqToCallback: true,
      profileFields: ['id', 'displayName', 'emails']
    },
    async (req, accessToken, refreshToken, profile, done) => {
      try {
        const userId = req.user?.id || req.session?.userId;
        if (!userId) {
          return done(new Error("User not authenticated"));
        }
        await saveToken(userId, 'facebook', accessToken, refreshToken, profile);
        return done(null, profile);
      } catch (err) {
        return done(err);
      }
    }
  ));
}

// --- Google Strategy (YouTube) ---
const saveGoogleCredentials = async (userId, accessToken, refreshToken) => {
  const expiryDate = new Date(Date.now() + 60 * 60 * 1000); // assume 1 hour access token lifetime
  const scope = [
    'https://www.googleapis.com/auth/youtube.upload',
    'https://www.googleapis.com/auth/youtube.readonly',
    'profile',
    'email'
  ].join(' ');

  await pool.query(
    `INSERT INTO google_credentials (user_id, access_token, refresh_token, token_expiry, scope, updated_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT (user_id) DO UPDATE SET
        access_token = EXCLUDED.access_token,
        refresh_token = COALESCE(EXCLUDED.refresh_token, google_credentials.refresh_token),
        token_expiry = EXCLUDED.token_expiry,
        scope = COALESCE(EXCLUDED.scope, google_credentials.scope),
        updated_at = NOW()`,
    [userId, accessToken, refreshToken, expiryDate, scope],
  );
};

if ((process.env.YOUTUBE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID) && (process.env.YOUTUBE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET)) {
  passport.use(new GoogleStrategy({
      clientID: process.env.YOUTUBE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.YOUTUBE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.YOUTUBE_REDIRECT_URI || process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5001/api/social-oauth/google/callback',
      passReqToCallback: true,
      // We'll pass the specific YouTube scopes in the route, but setup Strategy here
    },
    async (req, accessToken, refreshToken, profile, done) => {
      try {
        const userId = req.user?.id || req.session?.userId;
        if (!userId) {
          return done(new Error("User not authenticated", null));
        }
        await saveToken(userId, 'google', accessToken, refreshToken, profile);
        await saveGoogleCredentials(userId, accessToken, refreshToken);
        return done(null, profile);
      } catch (err) {
        return done(err);
      }
    }
  ));
}

// --- LinkedIn Strategy ---
if (process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET) {
  const linkedinStrategy = new LinkedInStrategy({
      clientID: process.env.LINKEDIN_CLIENT_ID,
      clientSecret: process.env.LINKEDIN_CLIENT_SECRET,
      callbackURL: process.env.LINKEDIN_REDIRECT_URI || 'http://localhost:5001/api/admin/linkedin/oauth/callback',
      scope: ['w_member_social', 'openid', 'profile', 'email'],
      state: true,
      passReqToCallback: true
    },
    async (req, accessToken, refreshToken, profile, done) => {
      try {
        const userId = req.user?.id || req.session?.userId;
        if (!userId) {
          return done(new Error("User not authenticated"));
        }
        await saveToken(userId, 'linkedin', accessToken, refreshToken, profile);
        return done(null, profile);
      } catch (err) {
        return done(err);
      }
    }
  );

  // Override userProfile to use /v2/userinfo (OpenID Connect) instead of
  // the deprecated /v2/me endpoint which returns 403 with new scopes.
  linkedinStrategy.userProfile = function (accessToken, done) {
    // Log token existence (don't log the full token for security)
    console.log('LinkedIn Access Token received:', accessToken ? 'Yes' : 'No');
    
    // Using a more standard OAuth2 request to ensure headers are correct
    this._oauth2.useAuthorizationHeaderforGET(true);
    this._oauth2.get('https://api.linkedin.com/v2/userinfo', accessToken, function (err, body) {
      if (err) {
        console.error('LinkedIn Profile Error Detail:', err);
        return done(new Error(`Failed to fetch LinkedIn user profile: ${err.message || 'Unknown Error'}`));
      }
      try {
        const json = typeof body === 'string' ? JSON.parse(body) : body;
        const profile = {
          provider: 'linkedin',
          id: json.sub,
          displayName: json.name || `${json.given_name || ''} ${json.family_name || ''}`.trim(),
          name: {
            givenName: json.given_name,
            familyName: json.family_name
          },
          emails: json.email ? [{ value: json.email }] : [],
          _raw: body,
          _json: json
        };
        done(null, profile);
      } catch (e) {
        done(e);
      }
    });
  };

  passport.use(linkedinStrategy);
}

export default passport;
