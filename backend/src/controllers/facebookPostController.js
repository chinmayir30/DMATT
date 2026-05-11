// Facebook Post Controller
import pool from '../config/database.js';
import fs from 'fs';
import * as facebookService from '../services/facebookService.js';

export const publishPost = async (req, res) => {
  let tempFilePath = null;
  try {
    const { pageId, message, contentType, mediaUrl } = req.body;
    const filePath = req.file?.path;
    tempFilePath = filePath;

    // Validate message
    if (!message || message.trim().length === 0) {
      return res.status(400).json({
        error: 'Post message is required'
      });
    }

    // Get tokens and page info
    const tokens = await facebookService.getTokens(req.user.id);

    if (!tokens) {
      return res.status(400).json({
        error: 'Facebook not connected'
      });
    }

    if (facebookService.isTokenExpired(tokens.expires_at)) {
      return res.status(401).json({
        error: 'Facebook token expired. Please reconnect.'
      });
    }

    const pageResult = await pool.query(
      'SELECT * FROM facebook_pages WHERE user_id = $1 AND page_id = $2',
      [req.user.id, pageId]
    );

    if (!pageResult.rows[0]) {
      return res.status(400).json({
        error: 'Invalid page selected'
      });
    }

    // Handle different content types
    let result;
    let imageUrlToSave = null;

    if (contentType === 'photo' || contentType === 'video') {
      const mediaSource = filePath || mediaUrl;
      if (!mediaSource) {
        return res.status(400).json({
          error: `${contentType} requires either a file upload or media URL`
        });
      }

      if (contentType === 'photo') {
        result = await facebookService.publishPhoto(
          pageResult.rows[0].page_access_token,
          pageId,
          message,
          mediaSource
        );
        // Save URL only if it's from internet (not local file)
        imageUrlToSave = mediaSource.startsWith('http') ? mediaSource : null;
      } else if (contentType === 'video') {
        result = await facebookService.publishVideo(
          pageResult.rows[0].page_access_token,
          pageId,
          message,
          mediaSource
        );
        // Save URL only if it's from internet (not local file)
        imageUrlToSave = mediaSource.startsWith('http') ? mediaSource : null;
      }
    } else {
      // Text post
      result = await facebookService.publishPost(
        pageResult.rows[0].page_access_token,
        pageId,
        message,
        null
      );
    }

    // Save post to database
    try {
      await facebookService.savePost(
        req.user.id,
        result.id,
        message,
        pageId,
        imageUrlToSave,
        contentType
      );
    } catch (dbError) {
      // Non-fatal error
      console.warn('Could not save post to database:', dbError);
    }

    res.status(201).json({
      success: true,
      message: 'Post published successfully',
      postId: result.id
    });

  } catch (error) {
    console.error('Error publishing Facebook post:', error);
    res.status(500).json({
      error: 'Failed to publish Facebook post',
      message: error.message
    });
  } finally {
    // Clean up temp file if it exists
    if (tempFilePath) {
      fs.unlink(tempFilePath, (err) => {
        if (err) console.error('Error deleting temp file:', err);
      });
    }
  }
};
export const getPages = async (req, res) => {
  try {
    console.log('🔍 Facebook getPages - User ID:', req.user.id);
    
    const result = await pool.query(
      'SELECT page_id, page_name FROM facebook_pages WHERE user_id = $1',
      [req.user.id]
    );

    console.log('✅ Facebook pages found:', result.rows.length, result.rows);

    res.json({
      success: true,
      pages: result.rows
    });

  } catch (error) {
    console.error('❌ Error fetching Facebook pages:', error);
    res.status(500).json({
      error: 'Failed to fetch Facebook pages',
      details: error.message
    });
  }
};
//new 
export const getStatus = async (req, res) => {
  try {
    const tokens = await facebookService.getTokens(req.user.id);

    if (!tokens) {
      return res.json({
        connected: false
      });
    }

    if (facebookService.isTokenExpired(tokens.expires_at)) {
      return res.json({
        connected: false,
        expired: true
      });
    }

    // Get basic profile again to ensure accuracy
    const profile = await facebookService.getUserProfile(tokens.access_token);

    // Count connected pages
    const pagesResult = await pool.query(
      'SELECT COUNT(*) FROM facebook_pages WHERE user_id = $1',
      [req.user.id]
    );

    res.json({
  connected: true,
  facebookUserName: profile.facebookUserName,
  facebookUserEmail: profile.facebookUserEmail,
  connectedAt: tokens.created_at || tokens.updated_at,
  pagesCount: parseInt(pagesResult.rows[0].count)
});

  } catch (error) {
    console.error('Error fetching Facebook status:', error);
    res.status(500).json({
      error: 'Failed to fetch Facebook status'
    });
  }
};
export const getStats = async (req, res) => {
  try {
    const tokens = await facebookService.getTokens(req.user.id);

    if (!tokens) {
      return res.json({
        totalPosts: 0,
        postsLast30Days: 0
      });
    }

    const pagesResult = await pool.query(
      'SELECT page_id, page_access_token FROM facebook_pages WHERE user_id = $1',
      [req.user.id]
    );

    let totalPosts = 0;
    let postsLast30Days = 0;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    for (const page of pagesResult.rows) {
      const posts = await facebookService.getPagePosts(
        page.page_access_token,
        page.page_id
      );

      totalPosts += posts.length;

      posts.forEach(post => {
        const created = new Date(post.created_time);
        if (created >= thirtyDaysAgo) {
          postsLast30Days++;
        }
      });
    }

    // Aggregate engagement across posts: likes, comments, shares
    let totalLikes = 0;
    let totalComments = 0;
    let totalShares = 0;

    try {
      for (const page of pagesResult.rows) {
        const posts = await facebookService.getPagePosts(
          page.page_access_token,
          page.page_id,
          100
        );

        for (const p of posts) {
          try {
            const metrics = facebookService.extractPostMetrics(p);
            totalLikes += Number(metrics.likesCount) || 0;
            totalComments += Number(metrics.commentsCount) || 0;
            totalShares += Number(metrics.sharesCount) || 0;
          } catch (e) {
            // ignore per-post enrichment errors
          }
        }
      }
    } catch (e) {
      console.error('Error aggregating Facebook engagement:', e?.message || e);
    }

    res.json({
      totalPosts,
      postsLast30Days,
      totalLikes,
      totalComments,
      totalShares
    });

  } catch (error) {
    console.error('Error fetching Facebook stats:', error);
    res.status(500).json({
      error: 'Failed to fetch Facebook stats'
    });
  }
};

export const getPosts = async (req, res) => {
  try {
    // Get posts from database (our saved posts with media URLs)
    const dbPosts = await pool.query(
      `SELECT fp.id, fp.facebook_post_id, fp.page_id, fp.message, fp.media_url, fp.media_type, fp.created_at,
              fp.likes_count, fp.comments_count, fp.shares_count, fp.metrics_last_synced_at,
              p.page_access_token
       FROM facebook_posts fp
       LEFT JOIN facebook_pages p ON p.user_id = fp.user_id AND p.page_id = fp.page_id
       WHERE fp.user_id = $1
       ORDER BY fp.created_at DESC
       LIMIT 20`,
      [req.user.id]
    );

    const posts = await Promise.all(
      dbPosts.rows.map(async (post) => {
        console.log("📌 POST ID:", post.facebook_post_id);
        const basePost = {
          id: post.id,
          facebookPostId: post.facebook_post_id,
          pageId: post.page_id,
          message: post.message || '',
          image_url: post.media_url,
          media_type: post.media_type,
          created_at: post.created_at,
          likesCount: Number(post.likes_count || 0),
          likedBy: [],
          commentsCount: Number(post.comments_count || 0),
          sharesCount: Number(post.shares_count || 0),
          metricsLastSyncedAt: post.metrics_last_synced_at,
          comments: []
        };

        if (!post.facebook_post_id || !post.page_access_token) {
          return basePost;
        }

        try {
          const [metrics, commentsRes, likesRes] = await Promise.all([
  facebookService.getPostMetrics(post.page_access_token, post.facebook_post_id),
  facebookService.getPostComments(post.page_access_token, post.facebook_post_id, 5),
  facebookService.getPostLikes(post.page_access_token, post.facebook_post_id, 5),
]);

console.log("📊 Post Debug:", {
  postId: post.facebook_post_id,
  metrics,
  comments: commentsRes?.comments?.length,
});

          await facebookService.updatePostMetrics(post.id, metrics);

          return {
            ...basePost,
            likesCount: metrics?.likesCount ?? 0,
commentsCount: metrics?.commentsCount ?? 0,
sharesCount: metrics?.sharesCount ?? 0,
           likesCount: likesRes.totalCount ?? 0,
           commentsCount: commentsRes.comments?.length ?? 0,
            sharesCount: Number(metrics.sharesCount) || 0,
            metricsLastSyncedAt: new Date(),
            comments: (commentsRes.comments || []).map((comment) => ({
              id: comment.id,
              fromName: comment.from?.name,
              fromId: comment.from?.id,
              message: comment.message,
              createdTime: comment.created_time,
            })),
          };
        } catch (enrichmentError) {
          console.warn('Could not enrich Facebook post engagement:', enrichmentError.message);
          return basePost;
        }
      })
    );

    res.json({
      posts
    });

  } catch (error) {
    console.error('Error fetching Facebook posts:', error);
    res.status(500).json({
      error: 'Failed to fetch Facebook posts'
    });
  }
};

// ✅ DIAGNOSTIC ENDPOINT - Debug Facebook connection issues
export const getDiagnostics = async (req, res) => {
  try {
    console.log('🔍 Running Facebook diagnostics for user:', req.user.id);
    
    const diagnostics = {
      userId: req.user.id,
      timestamp: new Date().toISOString(),
      checks: {}
    };

    // Check 1: OAuth tokens in database
    try {
      const tokenResult = await pool.query(
        'SELECT id, access_token, expires_at, facebook_user_id, facebook_user_name, facebook_user_email, created_at, updated_at FROM facebook_oauth_tokens WHERE user_id = $1',
        [req.user.id]
      );
      
      diagnostics.checks.tokens = {
        status: tokenResult.rows.length > 0 ? 'FOUND' : 'NOT_FOUND',
        count: tokenResult.rows.length,
        data: tokenResult.rows.length > 0 ? {
          stored: true,
          tokenExists: !!tokenResult.rows[0].access_token,
          expiresAt: tokenResult.rows[0].expires_at,
          isExpired: new Date() > new Date(tokenResult.rows[0].expires_at || 0),
          userName: tokenResult.rows[0].facebook_user_name,
          userEmail: tokenResult.rows[0].facebook_user_email,
          createdAt: tokenResult.rows[0].created_at,
          updatedAt: tokenResult.rows[0].updated_at
        } : null
      };
    } catch (e) {
      diagnostics.checks.tokens = {
        status: 'ERROR',
        error: e.message
      };
    }

    // Check 2: Pages in database
    try {
      const pagesResult = await pool.query(
        'SELECT id, page_id, page_name, page_access_token, created_at FROM facebook_pages WHERE user_id = $1',
        [req.user.id]
      );
      
      diagnostics.checks.pages = {
        status: pagesResult.rows.length > 0 ? 'FOUND' : 'NOT_FOUND',
        count: pagesResult.rows.length,
        pages: pagesResult.rows.map(p => ({
          pageId: p.page_id,
          pageName: p.page_name,
          tokenExists: !!p.page_access_token,
          createdAt: p.created_at
        }))
      };
    } catch (e) {
      diagnostics.checks.pages = {
        status: 'ERROR',
        error: e.message
      };
    }

    // Check 3: Posts in database
    try {
      const postsResult = await pool.query(
        'SELECT COUNT(*) as count FROM facebook_posts WHERE user_id = $1',
        [req.user.id]
      );
      
      diagnostics.checks.posts = {
        status: 'OK',
        count: parseInt(postsResult.rows[0].count)
      };
    } catch (e) {
      diagnostics.checks.posts = {
        status: 'ERROR',
        error: e.message
      };
    }

    // Check 4: Environment configuration
    diagnostics.checks.config = {
      facebookClientIdConfigured: !!process.env.FACEBOOK_CLIENT_ID,
      facebookClientSecretConfigured: !!process.env.FACEBOOK_CLIENT_SECRET,
      redirectUriConfigured: !!process.env.FACEBOOK_REDIRECT_URI,
      redirectUri: process.env.FACEBOOK_REDIRECT_URI
    };

    res.json({
      success: true,
      diagnostics
    });

  } catch (error) {
    console.error('Error running Facebook diagnostics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to run diagnostics',
      details: error.message
    });
  }
};
