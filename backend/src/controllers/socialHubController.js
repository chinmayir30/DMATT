import fs from 'fs/promises';
import { runMultiPlatformPost } from '../services/multiPlatformPostService.js';

export const postToAllPlatforms = async (req, res) => {
  const {
    content,
    contentType = 'text',
    mediaUrl,
    facebookPageId,
    youtubeTitle,
    youtubeDescription,
    youtubePrivacyStatus = 'unlisted',
  } = req.body || {};

  if (!content || !String(content).trim()) {
    return res.status(400).json({
      status: 'error',
      message: 'Post content is required',
    });
  }

  const filePath = req.file?.path || null;
  const fileName = req.file?.originalname || null;
  const userId = req.user.id;

  try {
    const { results, summary } = await runMultiPlatformPost({
      userId,
      content,
      contentType,
      mediaUrl,
      filePath,
      fileName,
      youtubeTitle,
      youtubeDescription,
      youtubePrivacyStatus,
      facebookPageId: facebookPageId || null,
    });

    return res.status(200).json({
      status: 'success',
      message: `Processed multi-platform post. Success: ${summary.successCount}, Skipped: ${summary.skippedCount}.`,
      data: {
        summary,
        results,
      },
    });
  } finally {
    if (filePath) {
      try {
        await fs.unlink(filePath);
      } catch {}
    }
  }
};
