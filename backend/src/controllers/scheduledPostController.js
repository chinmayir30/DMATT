import pool from '../config/database.js';

function parseScheduledAt(value) {
  if (!value || typeof value !== 'string') return null;
  const d = new Date(value.trim());
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

export const listScheduledPosts = async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT id, scheduled_at, content, content_type, media_url, status, result, error_message,
             created_at, updated_at, executed_at
      FROM scheduled_posts
      WHERE user_id = $1
      ORDER BY scheduled_at DESC
      LIMIT 100
      `,
      [req.user.id],
    );
    res.json({ posts: result.rows });
  } catch (err) {
    console.error('listScheduledPosts:', err);
    res.status(500).json({ message: 'Failed to list scheduled posts' });
  }
};

export const createScheduledPost = async (req, res) => {
  try {
    const {
      scheduledAt,
      content,
      contentType = 'text',
      mediaUrl = '',
      youtubeTitle = '',
      youtubeDescription = '',
      youtubePrivacyStatus = 'unlisted',
      facebookPageId = '',
    } = req.body || {};

    const text = typeof content === 'string' ? content.trim() : '';
    if (!text) {
      return res.status(400).json({ message: 'Post content is required' });
    }

    const when = parseScheduledAt(scheduledAt);
    if (!when) {
      return res.status(400).json({ message: 'scheduledAt must be a valid ISO date/time' });
    }

    const now = Date.now();
    if (when.getTime() <= now + 30_000) {
      return res.status(400).json({ message: 'Schedule time must be at least 1 minute in the future' });
    }

    const finalType = ['text', 'photo', 'video'].includes(contentType) ? contentType : 'text';
    const file = req.file;
    const mediaFilePath = file?.path || null;
    const mediaOriginalName = file?.originalname || null;

    const result = await pool.query(
      `
      INSERT INTO scheduled_posts (
        user_id, scheduled_at, content, content_type, media_url,
        media_file_path, media_original_name,
        youtube_title, youtube_description, youtube_privacy_status, facebook_page_id, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'pending')
      RETURNING id, scheduled_at, content, content_type, status, created_at
      `,
      [
        req.user.id,
        when.toISOString(),
        text,
        finalType,
        String(mediaUrl || '').trim() || null,
        mediaFilePath,
        mediaOriginalName,
        String(youtubeTitle || '').trim() || null,
        String(youtubeDescription || '').trim() || null,
        ['private', 'unlisted', 'public'].includes(String(youtubePrivacyStatus))
          ? youtubePrivacyStatus
          : 'unlisted',
        String(facebookPageId || '').trim() || null,
      ],
    );

    res.status(201).json({ post: result.rows[0] });
  } catch (err) {
    console.error('createScheduledPost:', err);
    if (req.file?.path) {
      try {
        const fs = await import('fs/promises');
        await fs.unlink(req.file.path);
      } catch {}
    }
    res.status(500).json({ message: err.message || 'Failed to create scheduled post' });
  }
};

export const cancelScheduledPost = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) {
      return res.status(400).json({ message: 'Invalid id' });
    }

    const sel = await pool.query(
      `SELECT id, status, media_file_path FROM scheduled_posts WHERE id = $1 AND user_id = $2`,
      [id, req.user.id],
    );
    const row = sel.rows[0];
    if (!row) {
      return res.status(404).json({ message: 'Scheduled post not found' });
    }
    if (row.status !== 'pending') {
      return res.status(400).json({ message: 'Only pending schedules can be cancelled' });
    }

    await pool.query(
      `UPDATE scheduled_posts SET status = 'cancelled', updated_at = NOW() WHERE id = $1`,
      [id],
    );

    if (row.media_file_path) {
      try {
        const fs = await import('fs/promises');
        await fs.unlink(row.media_file_path);
      } catch {}
      await pool.query(`UPDATE scheduled_posts SET media_file_path = NULL WHERE id = $1`, [id]);
    }

    res.json({ success: true });
  } catch (err) {
    console.error('cancelScheduledPost:', err);
    res.status(500).json({ message: 'Failed to cancel scheduled post' });
  }
};
