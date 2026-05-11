// LinkedIn Post Controller
// Handles LinkedIn post creation and management

import fs from 'fs';
import * as linkedinService from '../services/linkedinService.js';

const getLinkedInEngagementError = (error) => {
  const status = error?.response?.status;
  const message = error?.response?.data?.message || error?.message || 'LinkedIn engagement data unavailable';
  const permissionDenied = status === 403 || /not enough permissions|access_denied/i.test(message);

  return {
    status,
    message,
    permissionDenied,
    userMessage: permissionDenied
      ? 'LinkedIn API permission required to read likes, comments, and shares for member posts.'
      : message,
  };
};

/**
 * Publish a post to LinkedIn
 * POST /api/admin/linkedin/posts
 */
export const publishPost = async (req, res) => {
  let tempFilePath = null;
  try {
    const { content, contentType, mediaUrl } = req.body;
    const filePath = req.file?.path;
    tempFilePath = filePath;

    // Validate content
    if (!content || content.trim().length === 0) {
      return res.status(400).json({
        error: 'Post content is required'
      });
    }

    // Check content length (LinkedIn limit is 3000 characters)
    if (content.length > 3000) {
      return res.status(400).json({
        error: 'Post content exceeds 3000 character limit'
      });
    }

    // Get LinkedIn tokens
    const tokens = await linkedinService.getTokens(req.user.id);

    if (!tokens) {
      return res.status(401).json({
        error: 'LinkedIn account not connected',
        message: 'Please connect your LinkedIn account first'
      });
    }

    // Check if token is expired
    if (linkedinService.isTokenExpired(tokens.expires_at)) {
      return res.status(401).json({
        error: 'LinkedIn token expired',
        message: 'Please reconnect your LinkedIn account'
      });
    }

    // Handle different content types
    let publishedPost;
    let imageUrlToSave = null;

    if (contentType === 'photo' || contentType === 'video') {
      const mediaSource = filePath || mediaUrl;
      if (!mediaSource) {
        return res.status(400).json({
          error: `${contentType} requires either a file upload or media URL`
        });
      }

      if (contentType === 'photo') {
        publishedPost = await linkedinService.publishPhoto(
          tokens.access_token,
          tokens.linkedin_user_id,
          content,
          mediaSource
        );
        imageUrlToSave = mediaSource.startsWith('http') ? mediaSource : null;
      } else if (contentType === 'video') {
        publishedPost = await linkedinService.publishVideo(
          tokens.access_token,
          tokens.linkedin_user_id,
          content,
          mediaSource
        );
        imageUrlToSave = mediaSource.startsWith('http') ? mediaSource : null;
      }
    } else {
      // Text post
      publishedPost = await linkedinService.publishPost(
        tokens.access_token,
        tokens.linkedin_user_id,
        content,
        null
      );
    }

    // Generate post URL (best effort)
    const postUrl = `https://www.linkedin.com/feed/update/${publishedPost.urn}`;

    // Save post to database
    const savedPost = await linkedinService.savePost(
      req.user.id,
      publishedPost.id,
      content,
      postUrl,
      imageUrlToSave,
      publishedPost.urn,
      contentType
    );

    res.status(201).json({
      success: true,
      message: 'Post published successfully',
      post: {
        id: savedPost.id,
        linkedinPostId: savedPost.linkedin_post_id,
        content: savedPost.post_content,
        postUrl: savedPost.post_url,
        imageUrl: savedPost.image_url,
        publishedAt: savedPost.published_at
      }
    });
  } catch (error) {
    console.error('Error publishing post:', error);
    res.status(500).json({
      error: 'Failed to publish post',
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

/**
 * Get post history
 * GET /api/admin/linkedin/posts
 */
export const getPostHistory = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit, 10) || 5;
    const offset = (page - 1) * limit;

    // Get posts
    const posts = await linkedinService.getPostHistory(req.user.id, limit, offset);

    // Get total count
    const totalCount = await linkedinService.getPostCount(req.user.id);

    // Best-effort engagement enrichment (likes count + recent comments).
    // LinkedIn API may restrict access depending on the app permissions granted.
    let enrichedPosts = posts;
    try {
      const tokens = await linkedinService.getTokens(req.user.id);
      if (tokens?.access_token) {
        const accessToken = tokens.access_token;

        enrichedPosts = await Promise.all(
          posts.map(async (post) => {
            const ugcPostUrn = post.linkedin_urn;
            if (!ugcPostUrn) return post;

            try {
              let meta = {};
let comments = { comments: [] };

// ✅ Fetch meta safely
try {
  meta = await linkedinService.getUgcSocialMetadata(accessToken, ugcPostUrn);
} catch (e) {
  console.warn("Meta fetch failed:", e.message);
}

// ✅ Fetch comments safely
try {
  comments = await linkedinService.getUgcPostComments(accessToken, ugcPostUrn, 5);
} catch (e) {
  console.warn("Comments fetch failed:", e.message);
}

              await linkedinService.updatePostMetrics(post.id, {
                likesCount: meta.likesCount ?? 0,
                commentsCount: comments.comments?.length ?? 0,
                sharesCount: Number(meta.sharesCount || 0),
              });

              return {
  ...post,

  // ✅ Likes (safe fallback)
  likesCount: meta.likesCount ?? 0,

  // ✅ Comments (ALWAYS use actual comments array)
  commentsCount: comments.comments?.length ?? 0,

  // ✅ Shares
  sharesCount: meta.sharesCount ?? 0,

  metrics_last_synced_at: new Date(),
  metrics_error: null,

  // ✅ Proper comment mapping
  comments: (comments.comments || []).map(c => ({
    id: c.commentUrn,
    message: c.messageText,
    fromName: c.actor || 'User'
  })),
};
            } catch (e) {
              const engagementError = getLinkedInEngagementError(e);
              await linkedinService.updatePostMetrics(post.id, {
                likesCount: post.likes_count,
                commentsCount: post.comments_count,
                sharesCount: post.shares_count,
                error: engagementError.userMessage,
              });
             return {
  ...post,

  likesCount: meta.likesCount ?? 0,

  commentsCount: comments.comments?.length ?? 0,

  sharesCount: meta.sharesCount ?? 0,

  comments: (comments.comments || []).map(c => ({
    id: c.commentUrn,
    message: c.messageText,
    fromName: c.actor || 'User'
  })),
};
            }
          })
        );
      }
    } catch (e) {
      // If enrichment fails, return posts without engagement details.
    }

    res.json({
      posts: enrichedPosts,
      pagination: {
        page: page,
        limit: limit,
        totalCount: totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching post history:', error);
    res.status(500).json({
      error: 'Failed to fetch post history',
      message: error.message
    });
  }
};

/**
 * Get post statistics
 * GET /api/admin/linkedin/stats
 */
export const getPostStats = async (req, res) => {
  try {
    const totalPosts = await linkedinService.getPostCount(req.user.id);

    // Get posts from last 30 days
    const recentPosts = await linkedinService.getPostHistory(req.user.id, 1000, 0);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const postsLast30Days = recentPosts.filter(
      post => new Date(post.published_at) >= thirtyDaysAgo
    ).length;

    // Aggregate engagement across stored posts (best-effort using LinkedIn API)
    let totalLikes = 0;
    let totalComments = 0;
    let totalShares = 0;
    let engagementUnavailable = false;
    let engagementPermissionDenied = false;
    let engagementError = null;

    try {
      const tokens = await linkedinService.getTokens(req.user.id);
      if (tokens?.access_token) {
        const accessToken = tokens.access_token;

        // Only consider posts that have a LinkedIn URN
        const postsWithUrn = recentPosts.filter(p => p.linkedin_urn);

        const metas = await Promise.all(
          postsWithUrn.map(async (p) => {
            try {
              const meta = await linkedinService.getUgcSocialMetadata(accessToken, p.linkedin_urn);
              await linkedinService.updatePostMetrics(p.id, {
                likesCount: meta.likesCount ?? 0,
                commentsCount: comments.comments?.length ?? 0,
                sharesCount: Number(meta.sharesCount || 0),
              });
              return meta;
            } catch (e) {
              const errorInfo = getLinkedInEngagementError(e);
              await linkedinService.updatePostMetrics(p.id, {
                likesCount: p.likes_count,
                commentsCount: p.comments_count,
                sharesCount: p.shares_count,
                error: errorInfo.userMessage,
              });
              engagementUnavailable = true;
              engagementPermissionDenied = engagementPermissionDenied || errorInfo.permissionDenied;
              engagementError = engagementError || errorInfo.userMessage;
              return null;
            }
          })
        );

        for (const m of metas) {
          if (!m) continue;
          const likes = Number(m.likesCount) || 0;
          const comments = Number(m.commentsCount) || 0;
          totalLikes += likes;
          totalComments += comments;

          totalShares += Number(m.sharesCount) || 0;
        }
      }
    } catch (e) {
      // Non-fatal: if engagement aggregation fails, return zeroes for those fields
      console.error('Error aggregating LinkedIn engagement:', e?.message || e);
    }

    res.json({
      totalPosts: totalPosts,
      postsLast30Days: postsLast30Days,
      totalLikes: totalLikes,
      totalComments: totalComments,
      totalShares: totalShares,
      engagementUnavailable,
      engagementPermissionDenied,
      engagementError
    });
  } catch (error) {
    console.error('Error fetching post stats:', error);
    res.status(500).json({
      error: 'Failed to fetch post statistics',
      message: error.message
    });
  }
};
