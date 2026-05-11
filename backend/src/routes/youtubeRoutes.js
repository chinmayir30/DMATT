import express from "express";
import { google } from "googleapis";
import multer from "multer";
import fs from "fs";
import path from "path";
import pool from "../config/database.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();
const FRONTEND_URL = (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',')[0];


// ================= OAuth2 Client =================
const oauth2Client = new google.auth.OAuth2(
  process.env.YOUTUBE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID,
  process.env.YOUTUBE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET,
  process.env.YOUTUBE_REDIRECT_URI || process.env.GOOGLE_REDIRECT_URI,
);

// Helper to get tokens from social_accounts table
const getTokens = async (userId) => {
  if (userId) {
    try {
      const res = await pool.query(
        `SELECT access_token, refresh_token, provider_account_name, provider_account_email, created_at
         FROM social_accounts
         WHERE user_id = $1 AND provider = 'google'`,
        [userId],
      );
      if (res.rows.length > 0) {
        const row = res.rows[0];
        return {
          access_token: row.access_token,
          refresh_token: row.refresh_token,
          expiry_date: null,
          accountName: row.provider_account_name,
          accountEmail: row.provider_account_email,
          connectedAt: row.created_at,
        };
      }
    } catch (err) {
      console.warn("Failed to read tokens from DB for user", userId, err.message);
    }
  }
  return null;
};

// ================= Multer Setup =================
const upload = multer({ dest: "uploads/" });

import passport from 'passport';

// Redirect to frontend on success matching the original behavior
router.get('/callback', passport.authenticate('google', { session: false, failureRedirect: `${FRONTEND_URL}/youtube?error=Authentication+failed` }), (req, res) => {
  res.redirect(`${FRONTEND_URL}/youtube?success=true`);
});

// ================= 3. Check Connection Status =================
router.get("/status", authenticate, async (req, res) => {
  const tokens = await getTokens(req.user?.id);
  if (tokens) {
    try {
      oauth2Client.setCredentials(tokens);
      const youtube = google.youtube({ version: "v3", auth: oauth2Client });
      const channelRes = await youtube.channels.list({ part: "snippet", mine: true });
      const channel = channelRes.data.items?.[0];
      let googleProfile = null;
      try {
        const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
        const profileRes = await oauth2.userinfo.get();
        googleProfile = profileRes.data;
        if (googleProfile?.email || googleProfile?.name) {
          await pool.query(
            `UPDATE social_accounts
             SET provider_account_name = COALESCE($2, provider_account_name),
                 provider_account_email = COALESCE($3, provider_account_email),
                 updated_at = NOW()
             WHERE user_id = $1 AND provider = 'google'`,
            [req.user.id, googleProfile.name || null, googleProfile.email || null],
          );
        }
      } catch (profileError) {
        console.warn("Failed to fetch Google profile for YouTube status:", profileError.message);
      }
      return res.json({ 
        connected: true, 
        youtubeUserName: channel?.snippet?.title || tokens.accountName || googleProfile?.name || "Connected Account",
        youtubeUserEmail: tokens.accountEmail || googleProfile?.email || null,
        connectedAt: tokens.connectedAt || new Date()
      });
    } catch(e) {
      return res.json({
        connected: true,
        youtubeUserName: tokens.accountName || "Connected Account",
        youtubeUserEmail: tokens.accountEmail || null,
        connectedAt: tokens.connectedAt || new Date()
      });
    }
  }
  return res.json({
    connected: false,
    reason: "not_authenticated",
  });
});

// ================= 3.5 Check Stats =================
router.get("/stats", authenticate, async (req, res) => {
  try {
    const tokens = await getTokens(req.user?.id);
    if (!tokens) return res.status(401).json({ message: "Not authenticated" });
    
    oauth2Client.setCredentials(tokens);
    const youtube = google.youtube({ version: "v3", auth: oauth2Client });
    
    const channelRes = await youtube.channels.list({
      part: "statistics,contentDetails",
      mine: true
    });
    
    if (!channelRes.data.items || channelRes.data.items.length === 0) {
      return res.json({ totalPosts: 0, postsLast30Days: 0, totalLikes: 0, totalComments: 0, totalShares: 0 });
    }
    
    const channel = channelRes.data.items[0];
    const stats = channel.statistics || {};
    const uploadsPlaylistId = channel.contentDetails?.relatedPlaylists?.uploads;
    let totalLikes = 0;
    let totalComments = 0;

    if (uploadsPlaylistId) {
      const playlistRes = await youtube.playlistItems.list({
        part: "contentDetails",
        playlistId: uploadsPlaylistId,
        maxResults: 50,
      });

      const videoIds = (playlistRes.data.items || [])
        .map((item) => item.contentDetails?.videoId)
        .filter(Boolean);

      if (videoIds.length > 0) {
        const videosRes = await youtube.videos.list({
          part: "statistics",
          id: videoIds.join(","),
          maxResults: 50,
        });

        for (const video of videosRes.data.items || []) {
          totalLikes += Number(video.statistics?.likeCount || 0);
          totalComments += Number(video.statistics?.commentCount || 0);
        }
      }
    }
    
    res.json({
      totalPosts: parseInt(stats.videoCount || 0),
      postsLast30Days: parseInt(stats.viewCount || 0), // mapping total views to this field for UI compatibility
      totalLikes,
      totalComments, 
      totalShares: null,
      totalSubscribers: parseInt(stats.subscriberCount || 0)
    });
  } catch(error) {
    res.status(500).json({ error: error.message });
  }
});

// ================= 3.6 Disconnect =================
router.post("/disconnect", authenticate, async (req, res) => {
  try {
    // Remove DB-stored tokens for this user
    try {
      await pool.query(`DELETE FROM social_accounts WHERE user_id = $1 AND provider = 'google'`, [req.user.id]);
    } catch (e) {
      console.warn('Failed to delete social_accounts for user', req.user.id, e.message);
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================= 4. Upload Video =================
router.post("/upload", authenticate, upload.single("video"), async (req, res) => {
  try {
    const tokens = await getTokens(req.user.id);
    if (!tokens) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    oauth2Client.setCredentials(tokens);

    const youtube = google.youtube({
      version: "v3",
      auth: oauth2Client,
    });

    const response = await youtube.videos.insert({
      part: "snippet,status",
      requestBody: {
        snippet: {
          title: req.body.title,
          description: req.body.description,
        },
        status: {
          privacyStatus: req.body.privacyStatus || "unlisted",
        },
      },
      media: {
        body: fs.createReadStream(req.file.path),
      },
    });

    const videoId = response.data.id;

    // Delete the temporary uploaded file
    fs.unlinkSync(req.file.path);

    res.json({
      message: "Video uploaded successfully",
      videoId,
      url: `https://www.youtube.com/watch?v=${videoId}`,
    });
  } catch (error) {
    console.error("Upload Error:", error);
    res.status(500).json({
      message: "Upload failed",
      error: error.message,
    });
  }
});

// ================= 5. Fetch Videos with Stats & Comments =================
router.get("/videos", authenticate, async (req, res) => {
  try {
    const tokens = await getTokens(req.user.id);
    if (!tokens) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    oauth2Client.setCredentials(tokens);

    const youtube = google.youtube({
      version: "v3",
      auth: oauth2Client,
    });

    // Fetch user's videos
    const searchRes = await youtube.search.list({
      part: "snippet",
      forMine: true,
      type: "video",
      maxResults: 10,
      order: "date",
    });

    const videoIds = searchRes.data.items
      .map((item) => item.id.videoId)
      .filter(Boolean);

    // Fetch statistics
    const statsRes =
      videoIds.length > 0
        ? await youtube.videos.list({
            part: "snippet,statistics",
            id: videoIds.join(","),
          })
        : { data: { items: [] } };

    // Fetch comments
    const commentsData = await Promise.all(
      videoIds.map(async (id) => {
        try {
          const response = await youtube.commentThreads.list({
            part: "snippet",
            videoId: id,
            maxResults: 5,
          });

          return response.data.items.map((item) => {
            const comment = item.snippet.topLevelComment.snippet;
            return {
              id: item.id,
              fromName: comment.authorDisplayName || "User",
              message: comment.textDisplay || "",
              publishedAt: comment.publishedAt || null,
            };
          });
        } catch (err) {
          console.error("Comment Error:", err.message);
          return [];
        }
      }),
    );

    // Format response
    const videos = statsRes.data.items.map((video, index) => ({
      id: video.id,
      title: video.snippet.title,
      thumbnailUrl:
        video.snippet.thumbnails?.medium?.url ||
        video.snippet.thumbnails?.default?.url,
      publishedAt: video.snippet.publishedAt,
      views: Number(video.statistics.viewCount || 0),
      likesCount: Number(video.statistics.likeCount || 0),
      commentsCount: Number(video.statistics.commentCount || 0),
      sharesCount: null,
      comments: commentsData[index] || [],
    }));

    res.json({ videos });
  } catch (error) {
    console.error("Fetch Videos Error:", error);
    res.status(500).json({
      message: "Failed to fetch videos",
      error: error.message,
    });
  }
});

export default router;
