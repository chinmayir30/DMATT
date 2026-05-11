import pool from '../config/database.js';
import { getChannelOverview, getChannelStats, getRecentVideos, uploadVideo, getVideoComments } from '../services/youtubeService.js';
import fs from 'fs/promises';

function hasYouTubeScope(scopeStr = '') {
  const scopes = new Set(scopeStr.split(' ').filter(Boolean));
  return (
    scopes.has('https://www.googleapis.com/auth/youtube.upload') ||
    scopes.has('https://www.googleapis.com/auth/youtube') ||
    scopes.has('https://www.googleapis.com/auth/youtube.force-ssl') ||
    scopes.has('https://www.googleapis.com/auth/youtube.readonly')
  );
}

async function getGoogleCredential(userId) {
  const result = await pool.query(
    'SELECT access_token, refresh_token, token_expiry, scope, created_at FROM google_credentials WHERE user_id = $1',
    [userId]
  );
  return result.rows[0] || null;
}

export const getYouTubeStatus = async (req, res) => {
  try {
    const credential = await getGoogleCredential(req.user.id);

    if (!credential) {
      return res.json({
        connected: false,
        reason: 'google_not_connected',
        channelName: null,
        connectedAt: null,
      });
    }

    if (!hasYouTubeScope(credential.scope)) {
      return res.json({
        connected: false,
        reason: 'missing_youtube_scope',
        channelName: null,
        connectedAt: credential.created_at,
      });
    }

    const overview = await getChannelOverview(req.user.id);
    return res.json({
      connected: true,
      channelName: overview.channelName,
      channelId: overview.channelId,
      connectedAt: credential.created_at,
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

export const getYouTubeStats = async (req, res) => {
  try {
    const stats = await getChannelStats(req.user.id);
    res.json(stats);
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

export const getYouTubeVideos = async (req, res) => {
  try {
    const videos = await getRecentVideos(req.user.id);

    // Fetch comments for each video
    const enrichedVideos = await Promise.all(
      videos.map(async (video) => {
        const { comments } = await getVideoComments(req.user.id, video.id);
        return {
          ...video,
          comments,
        };
      })
    );

    res.json({ videos: enrichedVideos });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

export const uploadYouTubeVideo = async (req, res) => {
  let tmpPath;
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No video file provided' });
    }

    tmpPath = req.file.path;
    const title = (req.body?.title || '').toString().trim();
    const description = (req.body?.description || '').toString();
    const privacyStatus = (req.body?.privacyStatus || 'unlisted').toString();

    if (!['private', 'unlisted', 'public'].includes(privacyStatus)) {
      return res.status(400).json({ message: 'privacyStatus must be one of: private, unlisted, public' });
    }

    const result = await uploadVideo(req.user.id, {
      filePath: tmpPath,
      title: title || req.file.originalname,
      description,
      privacyStatus,
    });

    res.json({
      success: true,
      message: 'Video uploaded to YouTube',
      data: result,
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  } finally {
    if (tmpPath) {
      try { await fs.unlink(tmpPath); } catch {}
    }
  }
};
