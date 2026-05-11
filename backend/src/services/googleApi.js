// Google API Service
// Provides authenticated API clients for Google Search Console and Analytics
// Phase 3 - Task 1: Google API Setup & Authentication

import { google } from 'googleapis';
import pool from '../config/database.js';

/**
 * Get OAuth2 client with user's credentials
 * @param {number} userId - User ID
 * @returns {Promise<OAuth2Client>} Authenticated OAuth2 client
 */
export async function getAuthenticatedClient(userId) {
  // Fetch user's credentials from database
  const query = `
    SELECT access_token, refresh_token, token_expiry
    FROM google_credentials
    WHERE user_id = $1
  `;

  const result = await pool.query(query, [userId]);

  if (result.rows.length === 0) {
    throw new Error('Google account not connected. Please authenticate first.');
  }

  const credential = result.rows[0];

  // Create OAuth2 client
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  const credentials = {
    access_token: credential.access_token,
    refresh_token: credential.refresh_token,
  };

  if (credential.token_expiry) {
    credentials.expiry_date = new Date(credential.token_expiry).getTime();
  }

  oauth2Client.setCredentials(credentials);

  // Handle token refresh automatically
  oauth2Client.on('tokens', async (tokens) => {
    // Update tokens in database when refreshed
    const updateQuery = `
      UPDATE google_credentials
      SET
        access_token = $1,
        token_expiry = $2,
        updated_at = NOW()
      WHERE user_id = $3
    `;

    const newExpiry = new Date(tokens.expiry_date);
    await pool.query(updateQuery, [tokens.access_token, newExpiry, userId]);

    console.log('✓ Google access token refreshed for user:', userId);
  });

  return oauth2Client;
}

/**
 * Get Google Search Console API client
 * @param {number} userId - User ID
 * @returns {Promise<SearchConsole>} Authenticated Search Console client
 */
export async function getSearchConsoleClient(userId) {
  const auth = await getAuthenticatedClient(userId);
  return google.searchconsole({ version: 'v1', auth });
}

/**
 * Get Google Analytics Data API client (GA4)
 * @param {number} userId - User ID
 * @returns {Promise<AnalyticsData>} Authenticated Analytics Data client
 */
export async function getAnalyticsDataClient(userId) {
  const auth = await getAuthenticatedClient(userId);
  return google.analyticsdata({ version: 'v1beta', auth });
}

/**
 * Get PageSpeed Insights API client
 * @param {number} userId - User ID
 * @returns {Promise<PageSpeedInsights>} Authenticated PageSpeed client
 */
export async function getPageSpeedClient(userId) {
  const auth = await getAuthenticatedClient(userId);
  return google.pagespeedonline({ version: 'v5', auth });
}

/**
 * Verify user has valid Google credentials
 * @param {number} userId - User ID
 * @returns {Promise<boolean>} True if credentials exist and are valid
 */
export async function hasValidCredentials(userId) {
  try {
    const query = `
      SELECT id, token_expiry
      FROM google_credentials
      WHERE user_id = $1
    `;

    const result = await pool.query(query, [userId]);

    if (result.rows.length === 0) {
      return false;
    }

    // Even if token is expired, refresh token can get a new one
    // So we just check if credentials exist
    return true;
  } catch (error) {
    console.error('Error checking credentials:', error);
    return false;
  }
}

/**
 * Test Search Console API connection
 * @param {number} userId - User ID
 * @returns {Promise<Object>} List of Search Console sites
 */
export async function testSearchConsoleConnection(userId) {
  const searchConsole = await getSearchConsoleClient(userId);
  const response = await searchConsole.sites.list();
  return response.data;
}

/**
 * Test Analytics API connection
 * @param {number} userId - User ID
 * @param {string} propertyId - GA4 Property ID
 * @returns {Promise<Object>} Sample analytics data
 */
export async function testAnalyticsConnection(userId, propertyId) {
  const analyticsData = await getAnalyticsDataClient(userId);

  const response = await analyticsData.properties.runReport({
    property: `properties/${propertyId}`,
    requestBody: {
      dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
      metrics: [{ name: 'activeUsers' }],
    },
  });

  return response.data;
}

export default {
  getAuthenticatedClient,
  getSearchConsoleClient,
  getAnalyticsDataClient,
  getPageSpeedClient,
  hasValidCredentials,
  testSearchConsoleConnection,
  testAnalyticsConnection,
};
