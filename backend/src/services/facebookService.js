// Facebook Service
import axios from "axios";
import pool from "../config/database.js";

const FB_OAUTH_URL = "https://www.facebook.com/v17.0/dialog/oauth";
const FB_TOKEN_URL = "https://graph.facebook.com/v17.0/oauth/access_token";
const FB_API_BASE = "https://graph.facebook.com/v17.0";

export function getAuthorizationUrl(state) {
  const params = new URLSearchParams({
    client_id: process.env.FACEBOOK_CLIENT_ID,
    redirect_uri: process.env.FACEBOOK_REDIRECT_URI,
    state,
    scope:
      "email,public_profile,pages_read_engagement,pages_read_user_content,pages_manage_posts,pages_show_list",
  });

  return `${FB_OAUTH_URL}?${params.toString()}`;
}

export async function exchangeCodeForToken(code) {
  try {
    const params = new URLSearchParams({
      client_id: process.env.FACEBOOK_CLIENT_ID,
      client_secret: process.env.FACEBOOK_CLIENT_SECRET,
      redirect_uri: process.env.FACEBOOK_REDIRECT_URI,
      code,
    });

    const resp = await axios.get(`${FB_TOKEN_URL}?${params.toString()}`);
    return resp.data; // contains access_token, token_type, expires_in
  } catch (err) {
    console.error(
      "Error exchanging Facebook code for token:",
      err.response?.data || err.message,
    );
    throw new Error("Failed to exchange code for token");
  }
}

export async function exchangeForLongLivedToken(shortLivedToken) {
  try {
    const params = new URLSearchParams({
      grant_type: "fb_exchange_token",
      client_id: process.env.FACEBOOK_CLIENT_ID,
      client_secret: process.env.FACEBOOK_CLIENT_SECRET,
      fb_exchange_token: shortLivedToken,
    });

    const resp = await axios.get(`${FB_TOKEN_URL}?${params.toString()}`);
    return resp.data; // contains access_token and expires_in
  } catch (err) {
    console.error(
      "Error exchanging for long-lived token:",
      err.response?.data || err.message,
    );
    throw new Error("Failed to exchange for long-lived token");
  }
}

export async function getUserProfile(accessToken) {
  try {
    const resp = await axios.get(`${FB_API_BASE}/me`, {
      params: { access_token: accessToken, fields: "id,name,email" },
    });

    return {
      facebookUserId: resp.data.id,
      facebookUserName: resp.data.name,
      facebookUserEmail: resp.data.email || null,
    };
  } catch (err) {
    console.error(
      "Error fetching Facebook profile:",
      err.response?.data || err.message,
    );
    throw new Error("Failed to fetch Facebook profile");
  }
}

export async function getUserPages(accessToken) {
  try {
    const resp = await axios.get(`${FB_API_BASE}/me/accounts`, {
      params: { access_token: accessToken },
    });

    // returns data: [{ id, name, access_token, ... }, ...]
    return resp.data.data || [];
  } catch (err) {
    console.error(
      "Error fetching Facebook pages:",
      err.response?.data || err.message,
    );
    throw new Error("Failed to fetch Facebook pages");
  }
}

export async function syncUserPages(userId, pages = []) {
  console.log('💾 Storing Facebook pages - User:', userId, 'Pages count:', pages.length);

  // Store pages (upsert)
  for (const p of pages) {
    console.log('   Storing page:', p.id, p.name);
    const q = `
			INSERT INTO facebook_pages (user_id, page_id, page_name, page_access_token, created_at)
			VALUES ($1, $2, $3, $4, NOW())
			ON CONFLICT (user_id, page_id)
			DO UPDATE SET page_access_token = EXCLUDED.page_access_token, page_name = EXCLUDED.page_name
		`;

    await pool.query(q, [
      userId,
      p.id,
      p.name || p.page_name || "Page",
      p.access_token || p.page_access_token,
    ]);
  }
  
  console.log('✅ All facebook pages stored');
}

export async function deleteTokens(userId) {
  try {
    await pool.query("DELETE FROM social_accounts WHERE user_id = $1 AND provider = 'facebook'", [userId]);
    await pool.query("DELETE FROM facebook_pages WHERE user_id = $1", [userId]);
  } catch (err) {
    console.error(
      "Error deleting Facebook tokens/pages for user",
      userId,
      err.message || err,
    );
    throw err;
  }
}

/**
 * Save post to database
 * @param {number} userId - User ID
 * @param {string} facebookPostId - Facebook post ID
 * @param {string} message - Post message
 * @param {string} pageId - Facebook page ID
 * @param {string|null} mediaUrl - Media URL if media post
 * @param {string} mediaType - Media type (text, photo, video)
 * @returns {Promise<Object>} Saved post data
 */
export async function savePost(userId, facebookPostId, message, pageId, mediaUrl, mediaType = 'text') {
  try {
    const query = `
      INSERT INTO facebook_posts
      (user_id, page_id, facebook_post_id, message, media_url, media_type, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      RETURNING *
    `;

    const result = await pool.query(query, [
      userId,
      pageId,
      facebookPostId,
      message,
      mediaUrl,
      mediaType
    ]);

    return result.rows[0];
  } catch (err) {
    console.error('Error saving Facebook post to database:', err.message);
    // Non-fatal - continue even if database save fails
  }
}

export async function getTokens(userId) {
  const result = await pool.query(
    "SELECT access_token, refresh_token, updated_at as created_at, provider_account_id as facebook_user_id, provider_account_name as facebook_user_name FROM social_accounts WHERE user_id = $1 AND provider = 'facebook'",
    [userId],
  );
  return result.rows[0] || null;
}

export function isTokenExpired(expiresAt) {
  return false;
}

export async function publishPost(pageAccessToken, pageId, message) {
  try {
    const resp = await axios.post(`${FB_API_BASE}/${pageId}/feed`, null, {
      params: { message, access_token: pageAccessToken },
    });

    // Save to facebook_posts table
    try {
      await pool.query(
        `INSERT INTO facebook_posts (user_id, page_id, facebook_post_id, message, created_time, created_at)
				 VALUES ($1, $2, $3, $4, NOW(), NOW())`,
        [null, pageId, resp.data.id, message],
      );
    } catch (e) {
      // non-fatal if DB insert fails
    }

    return resp.data;
  } catch (err) {
    console.error(
      "Error publishing Facebook post:",
      err.response?.data || err.message,
    );
    throw new Error("Failed to publish Facebook post");
  }
}

/**
 * Publish a photo to Facebook page
 * @param {string} pageAccessToken - Page access token
 * @param {string} pageId - Facebook page ID
 * @param {string} message - Caption for the photo
 * @param {string} mediaSource - File path or URL to photo
 * @returns {Promise<Object>} Photo data
 */
export async function publishPhoto(pageAccessToken, pageId, message, mediaSource) {
  try {
    const fs = await import('fs');
    const FormData = await import('form-data');
    
    const form = new FormData.default();
    form.append('caption', message);
    form.append('access_token', pageAccessToken);

    // Handle file or URL
    if (mediaSource.startsWith('http')) {
      const response = await axios.get(mediaSource, { responseType: 'arraybuffer' });
      form.append('source', Buffer.from(response.data), { filename: 'image.jpg' });
    } else {
      form.append('source', fs.createReadStream(mediaSource), {
        filename: mediaSource.split(/[\\/]/).pop() || 'image.jpg',
      });
    }

    const resp = await axios.post(`${FB_API_BASE}/${pageId}/photos`, form, {
      headers: form.getHeaders(),
    });

    console.log('Facebook photo published:', resp.data.id);
    return resp.data;
  } catch (err) {
    console.error(
      "Error publishing Facebook photo:",
      err.response?.data || err.message,
    );
    throw new Error(err.response?.data?.error?.message || "Failed to publish photo to Facebook");
  }
}

/**
 * Publish a video to Facebook page
 * @param {string} pageAccessToken - Page access token
 * @param {string} pageId - Facebook page ID
 * @param {string} message - Description for the video
 * @param {string} mediaSource - File path or URL to video
 * @returns {Promise<Object>} Video data
 */
export async function publishVideo(pageAccessToken, pageId, message, mediaSource) {
  try {
    const fs = await import('fs');
    const FormData = await import('form-data');
    
    const form = new FormData.default();
    form.append('description', message);
    form.append('access_token', pageAccessToken);

    // Handle file or URL
    if (mediaSource.startsWith('http')) {
      const response = await axios.get(mediaSource, { responseType: 'arraybuffer' });
      form.append('source', Buffer.from(response.data), { filename: 'video.mp4' });
    } else {
      const fileBuffer = fs.readFileSync(mediaSource);
      form.append('source', fileBuffer, { filename: 'video.mp4' });
    }

    const resp = await axios.post(`${FB_API_BASE}/${pageId}/videos`, form, {
      headers: form.getHeaders(),
    });

    console.log('Facebook video published:', resp.data.id);
    return resp.data;
  } catch (err) {
    console.error(
      "Error publishing Facebook video:",
      err.response?.data || err.message,
    );
    throw new Error(err.response?.data?.error?.message || "Failed to publish video to Facebook");
  }
}

export async function getPagePosts(pageAccessToken, pageId, limit = 10) {
  try {
    const resp = await axios.get(`${FB_API_BASE}/${pageId}/posts`, {
      params: {
        access_token: pageAccessToken,
        fields: "message,created_time,likes.limit(0).summary(true),comments.limit(0).summary(true),sharedposts.limit(0).summary(true)",
        limit,
      },
    });

    return resp.data.data || [];
  } catch (err) {
    console.error(
      "Error fetching page posts:",
      err.response?.data || err.message,
    );
    return [];
  }
}

export function extractPostMetrics(postData = {}) {
  return {
    likesCount: Number(postData.likes?.summary?.total_count || 0),
    commentsCount: Number(postData.comments?.summary?.total_count || 0),
    sharesCount: Number(postData.sharedposts?.summary?.total_count || 0),
  };
}

export async function getPostMetrics(pageAccessToken, postId) {
  try {
    const resp = await axios.get(`${FB_API_BASE}/${postId}`, {
      params: {
        access_token: pageAccessToken,
        fields: "id,likes.limit(0).summary(true),comments.limit(0).summary(true),sharedposts.limit(0).summary(true)",
      },
    });

    const data = resp.data;

    return {
      likesCount: data.likes?.summary?.total_count ?? 0,
      commentsCount: data.comments?.summary?.total_count ?? 0,
      sharesCount: data.sharedposts?.summary?.total_count ?? 0,
    };
  } catch (err) {
    console.error("❌ Metrics fetch error:", err.response?.data || err.message);

    return {
      likesCount: 0,
      commentsCount: 0,
      sharesCount: 0,
    };
  }
}
 

export async function updatePostMetrics(postRowId, metrics) {
  if (!postRowId) return;

  await pool.query(
    `UPDATE facebook_posts
     SET likes_count = $2,
         comments_count = $3,
         shares_count = $4,
         metrics_last_synced_at = NOW()
     WHERE id = $1`,
    [
      postRowId,
      Number(metrics.likesCount || 0),
      Number(metrics.commentsCount || 0),
      Number(metrics.sharesCount || 0),
    ],
  );
}

export async function getPostLikes(pageAccessToken, postId, limit = 5) {
  try {
    const resp = await axios.get(`${FB_API_BASE}/${postId}/likes`, {
      params: { access_token: pageAccessToken, limit, summary: true },
    });

    return {
  totalCount: resp.data.summary?.total_count ?? 0,
  likedBy: resp.data.data || [],
};
  } catch (err) {
    return { totalCount: null, likedBy: [] };
  }
}

export async function getPostComments(pageAccessToken, postId, limit = 5) {
  try {
    const resp = await axios.get(`${FB_API_BASE}/${postId}/comments`, {
      params: {
        access_token: pageAccessToken,
        limit,
        fields: "id,message,from,created_time",
      },
    });

    return {
      comments: resp.data.data || [],
    };
  } catch (err) {
    console.error("❌ Comments fetch error:", err.response?.data || err.message);
    return { comments: [] };
  }
}

export async function getPostShares(pageAccessToken, postId) {
  try {
    // Query post for shared posts summary instead of the deprecated shares field
    const resp = await axios.get(`${FB_API_BASE}/${postId}`, {
      params: {
        access_token: pageAccessToken,
        fields: "sharedposts.limit(0).summary(true)",
      },
    });

    const sharesCount = resp.data.sharedposts?.summary?.total_count ?? null;
    return { totalCount: sharesCount };
  } catch (err) {
    console.error("Error fetching post shares:", err.response?.data || err.message);
    return { totalCount: null };
  }
}
