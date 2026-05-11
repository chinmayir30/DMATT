import { google } from 'googleapis';
import fs from 'fs';
import pool from '../config/database.js';

function createYouTubeOAuthClient() {
  return new google.auth.OAuth2(
    process.env.YOUTUBE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID,
    process.env.YOUTUBE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET,
    process.env.YOUTUBE_REDIRECT_URI || process.env.GOOGLE_REDIRECT_URI,
  );
}

async function getStoredYouTubeCredentials(userId) {
  const socialResult = await pool.query(
    `SELECT access_token, refresh_token, created_at
     FROM social_accounts
     WHERE user_id = $1 AND provider = 'google'`,
    [userId],
  );

  if (socialResult.rows.length > 0) {
    const row = socialResult.rows[0];
    return {
      access_token: row.access_token,
      refresh_token: row.refresh_token,
      expiry_date: null,
      source: 'social_accounts',
      connectedAt: row.created_at || null,
    };
  }

  const googleResult = await pool.query(
    `SELECT access_token, refresh_token, token_expiry
     FROM google_credentials
     WHERE user_id = $1`,
    [userId],
  );

  if (googleResult.rows.length > 0) {
    const row = googleResult.rows[0];
    return {
      access_token: row.access_token,
      refresh_token: row.refresh_token,
      expiry_date: row.token_expiry ? new Date(row.token_expiry).getTime() : null,
      source: 'google_credentials',
      connectedAt: null,
    };
  }

  throw new Error('Google account not connected. Please authenticate first.');
}

async function getAuthenticatedYouTubeClient(userId) {
  const oauth2Client = createYouTubeOAuthClient();
  const credential = await getStoredYouTubeCredentials(userId);

  oauth2Client.setCredentials({
    access_token: credential.access_token,
    refresh_token: credential.refresh_token,
    expiry_date: credential.expiry_date || undefined,
  });

  oauth2Client.on('tokens', async (tokens) => {
    const expiry = tokens.expiry_date ? new Date(tokens.expiry_date) : null;

    await Promise.allSettled([
      pool.query(
        `UPDATE social_accounts
         SET access_token = COALESCE($2, access_token),
             refresh_token = COALESCE($3, refresh_token),
             updated_at = NOW()
         WHERE user_id = $1 AND provider = 'google'`,
        [userId, tokens.access_token || null, tokens.refresh_token || null],
      ),
      pool.query(
        `UPDATE google_credentials
         SET access_token = COALESCE($2, access_token),
             refresh_token = COALESCE($3, refresh_token),
             token_expiry = COALESCE($4, token_expiry),
             updated_at = NOW()
         WHERE user_id = $1`,
        [userId, tokens.access_token || null, tokens.refresh_token || null, expiry],
      ),
    ]);
  });

  return oauth2Client;
}

function getYouTubeClient(auth) {
  return google.youtube({ version: 'v3', auth });
}

export async function getChannelOverview(userId) {
  const auth = await getAuthenticatedYouTubeClient(userId);
  const youtube = getYouTubeClient(auth);

  const resp = await youtube.channels.list({
    part: ['snippet'],
    mine: true,
    maxResults: 1,
  });

  const channel = resp.data.items?.[0];
  if (!channel) {
    throw new Error('No YouTube channel found for this Google account.');
  }

  return {
    channelId: channel.id,
    channelName: channel.snippet?.title || null,
  };
}

export async function getChannelStats(userId) {
  const auth = await getAuthenticatedYouTubeClient(userId);
  const youtube = getYouTubeClient(auth);

  const resp = await youtube.channels.list({
    part: ['statistics'],
    mine: true,
    maxResults: 1,
  });

  const stats = resp.data.items?.[0]?.statistics;
  if (!stats) {
    throw new Error('Failed to fetch YouTube channel statistics.');
  }

  return {
    subscribers: Number(stats.subscriberCount || 0),
    totalViews: Number(stats.viewCount || 0),
    videoCount: Number(stats.videoCount || 0),
  };
}

export async function getRecentVideos(userId, limit = 10) {
  const auth = await getAuthenticatedYouTubeClient(userId);
  const youtube = getYouTubeClient(auth);

  const searchResp = await youtube.search.list({
    part: ['snippet'],
    forMine: true,
    type: ['video'],
    order: 'date',
    maxResults: limit,
  });

  const items = searchResp.data.items || [];
  const ids = items
    .map((it) => it.id?.videoId)
    .filter(Boolean);

  if (ids.length === 0) return [];

  const videosResp = await youtube.videos.list({
    part: ['snippet', 'statistics'],
    id: ids,
    maxResults: limit,
  });

  const byId = new Map((videosResp.data.items || []).map((v) => [v.id, v]));

  return ids
    .map((id) => byId.get(id))
    .filter(Boolean)
    .map((v) => ({
      id: v.id,
      title: v.snippet?.title || '(untitled)',
      description: v.snippet?.description || '',
      views: Number(v.statistics?.viewCount || 0),
      likesCount: Number(v.statistics?.likeCount || 0),
      commentsCount: Number(v.statistics?.commentCount || 0),
      sharesCount: 0, // YouTube doesn't provide share counts
      publishedAt: v.snippet?.publishedAt || null,
      thumbnailUrl: v.snippet?.thumbnails?.default?.url || null,
    }));
}

export async function uploadVideo(userId, { filePath, title, description, privacyStatus = 'unlisted' }) {
  const auth = await getAuthenticatedYouTubeClient(userId);
  const youtube = getYouTubeClient(auth);

  const resp = await youtube.videos.insert({
    part: ['snippet', 'status'],
    requestBody: {
      snippet: {
        title: title || 'Untitled upload',
        description: description || '',
      },
      status: {
        privacyStatus,
      },
    },
    media: {
      body: fs.createReadStream(filePath),
    },
  });

  const id = resp.data?.id;
  return {
    id,
    url: id ? `https://www.youtube.com/watch?v=${id}` : null,
    raw: resp.data,
  };
}

export async function getVideoComments(userId, videoId, limit = 5) {
  const auth = await getAuthenticatedYouTubeClient(userId);
  const youtube = getYouTubeClient(auth);

  try {
    const resp = await youtube.commentThreads.list({
      part: ['snippet'],
      videoId: videoId,
      maxResults: limit,
      order: 'relevance',
    });

    const comments = (resp.data.items || []).map((item) => {
      const comment = item.snippet?.topLevelComment?.snippet;
      return {
        id: item.id,
        message: comment?.textDisplay || '',
        fromName: comment?.authorDisplayName || 'User',
        publishedAt: comment?.publishedAt || null,
      };
    });

    return { comments };
  } catch (error) {
    console.error('Error fetching YouTube comments:', error);
    return { comments: [] };
  }
}
