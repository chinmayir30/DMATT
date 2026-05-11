import cron from 'node-cron';
import fs from 'fs/promises';
import pool from '../config/database.js';
import { runMultiPlatformPost } from './multiPlatformPostService.js';

async function claimNextJob() {
  const { rows } = await pool.query(`
    WITH next_job AS (
      SELECT id
      FROM scheduled_posts
      WHERE status = 'pending' AND scheduled_at <= NOW()
      ORDER BY scheduled_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    UPDATE scheduled_posts s
    SET status = 'processing', updated_at = NOW()
    FROM next_job n
    WHERE s.id = n.id
    RETURNING s.*
  `);
  return rows[0] || null;
}

async function processJob(job) {
  const filePath = job.media_file_path || null;
  const fileName = job.media_original_name || null;

  try {
    const { results, summary } = await runMultiPlatformPost({
      userId: job.user_id,
      content: job.content,
      contentType: job.content_type,
      mediaUrl: job.media_url || '',
      filePath,
      fileName,
      youtubeTitle: job.youtube_title || '',
      youtubeDescription: job.youtube_description || '',
      youtubePrivacyStatus: job.youtube_privacy_status || 'unlisted',
      facebookPageId: job.facebook_page_id || null,
    });

    await pool.query(
      `
      UPDATE scheduled_posts
      SET status = 'completed',
          result = $1::jsonb,
          error_message = NULL,
          executed_at = NOW(),
          updated_at = NOW(),
          media_file_path = NULL
      WHERE id = $2
      `,
      [JSON.stringify({ results, summary }), job.id],
    );
  } catch (err) {
    const msg = err?.message || String(err);
    await pool.query(
      `
      UPDATE scheduled_posts
      SET status = 'failed',
          error_message = $1,
          executed_at = NOW(),
          updated_at = NOW(),
          media_file_path = NULL
      WHERE id = $2
      `,
      [msg.slice(0, 2000), job.id],
    );
    throw err;
  } finally {
    if (filePath) {
      try {
        await fs.unlink(filePath);
      } catch {}
    }
  }
}

export async function tickScheduledPosts() {
  for (;;) {
    const job = await claimNextJob();
    if (!job) break;
    try {
      await processJob(job);
    } catch (e) {
      console.error('[scheduled-posts] job failed:', job?.id, e?.message || e);
    }
  }
}

let started = false;

export function startScheduledPostWorker() {
  if (started) return;
  started = true;
  cron.schedule('* * * * *', () => {
    tickScheduledPosts().catch((e) => console.error('[scheduled-posts] tick error:', e));
  });
  tickScheduledPosts().catch((e) => console.error('[scheduled-posts] initial tick:', e));
  console.log('[scheduled-posts] Worker: cron every minute');
}
