import os from "os";
import path from "path";
import fs from "fs/promises";
import axios from "axios";
import pool from "../config/database.js";
import * as linkedinService from "./linkedinService.js";
import * as facebookService from "./facebookService.js";
import { uploadVideo } from "./youtubeService.js";

function isHttpUrl(value) {
  return /^https?:\/\//i.test(String(value || "").trim());
}

function getTempVideoExtension(mediaUrl, contentType = "") {
  const lowerContentType = String(contentType || "").toLowerCase();
  if (lowerContentType.includes("quicktime")) return ".mov";
  if (lowerContentType.includes("webm")) return ".webm";
  if (lowerContentType.includes("ogg")) return ".ogv";
  if (lowerContentType.includes("mpeg")) return ".mpeg";
  if (lowerContentType.includes("mp4")) return ".mp4";

  try {
    const pathname = new URL(mediaUrl).pathname.toLowerCase();
    const ext = path.extname(pathname);
    return ext || ".mp4";
  } catch {
    return ".mp4";
  }
}

async function downloadRemoteVideoToTempFile(mediaUrl) {
  const response = await axios.get(mediaUrl, {
    responseType: "arraybuffer",
    maxRedirects: 5,
  });

  const extension = getTempVideoExtension(
    mediaUrl,
    response.headers?.["content-type"],
  );
  const tempPath = path.join(
    os.tmpdir(),
    `dmat-social-hub-youtube-${Date.now()}${extension}`,
  );

  await fs.writeFile(tempPath, Buffer.from(response.data));
  return tempPath;
}

/**
 * Publish the same content to LinkedIn, Facebook, WhatsApp, and YouTube (when applicable).
 * @param {object} params
 * @param {number} params.userId
 * @param {string} params.content
 * @param {'text'|'photo'|'video'} [params.contentType]
 * @param {string} [params.mediaUrl]
 * @param {string|null} [params.filePath] - temp path for uploaded video (deleted by caller)
 * @param {string|null} [params.fileName]
 * @param {string} [params.youtubeTitle]
 * @param {string} [params.youtubeDescription]
 * @param {string} [params.youtubePrivacyStatus]
 * @param {string|null} [params.facebookPageId]
 * @returns {Promise<{ results: object, summary: object }>}
 */
export async function runMultiPlatformPost({
  userId,
  content,
  contentType = "text",
  mediaUrl = "",
  filePath = null,
  fileName = null,
  youtubeTitle = "",
  youtubeDescription = "",
  youtubePrivacyStatus = "unlisted",
  facebookPageId = null,
}) {
  const text = String(content || "").trim();
  const finalType = ["text", "photo", "video"].includes(contentType)
    ? contentType
    : "text";
  const safeMediaUrl = String(mediaUrl || "").trim();
  const remoteMediaUrl = isHttpUrl(safeMediaUrl) ? safeMediaUrl : "";

  const results = {
    linkedin: { success: false, skipped: false, message: "" },
    facebook: { success: false, skipped: false, message: "" },
    // whatsapp removed
    youtube: {
      success: false,
      skipped: true,
      message: "Skipped: YouTube posting requires video content type.",
    },
  };

  // LinkedIn
  try {
    let linkedInText = text;
    // Social Hub asks for a URL for LinkedIn/Facebook and a file for YouTube.
    // Prefer the direct URL for LinkedIn when present; fall back to the uploaded file.
    const linkedInMediaSource = remoteMediaUrl || filePath || null;

    if (linkedInText.length > 3000) {
      results.linkedin = {
        success: false,
        skipped: true,
        message: "Skipped: LinkedIn post exceeds 3000 characters.",
      };
    } else {
      const tokens = await linkedinService.getTokens(userId);
      if (!tokens) {
        results.linkedin = {
          success: false,
          skipped: true,
          message: "Skipped: LinkedIn account not connected.",
        };
      } else if (linkedinService.isTokenExpired(tokens.expires_at)) {
        results.linkedin = {
          success: false,
          skipped: true,
          message: "Skipped: LinkedIn token expired. Reconnect LinkedIn.",
        };
      } else {
        let publishedPost;

        if (finalType === "photo") {
          if (!linkedInMediaSource) {
            publishedPost = await linkedinService.publishPost(
              tokens.access_token,
              tokens.linkedin_user_id,
              linkedInText,
              null,
            );
          } else {
            publishedPost = await linkedinService.publishPhoto(
              tokens.access_token,
              tokens.linkedin_user_id,
              linkedInText,
              linkedInMediaSource,
            );
          }
        } else if (finalType === "video") {
          if (!linkedInMediaSource) {
            results.linkedin = {
              success: false,
              skipped: true,
              message:
                "Skipped: LinkedIn video requires an uploaded file or a video URL.",
            };
          } else {
            publishedPost = await linkedinService.publishVideo(
              tokens.access_token,
              tokens.linkedin_user_id,
              linkedInText,
              linkedInMediaSource,
            );
          }
        } else {
          publishedPost = await linkedinService.publishPost(
            tokens.access_token,
            tokens.linkedin_user_id,
            linkedInText,
            null,
          );
        }

        if (publishedPost) {
          const postUrl = `https://www.linkedin.com/feed/update/${publishedPost.urn}`;
          await linkedinService.savePost(
            userId,
            publishedPost.id,
            linkedInText,
            postUrl,
            remoteMediaUrl || null,
            publishedPost.urn,
          );

          results.linkedin = {
            success: true,
            skipped: false,
            message:
              finalType === "text"
                ? "Posted successfully."
                : `Posted successfully as ${finalType === "video" ? "video" : "media"}.`,
            postId: publishedPost.id,
            postUrl,
          };
        }
      }
    }
  } catch (error) {
    results.linkedin = {
      success: false,
      skipped: false,
      message: error.message || "LinkedIn posting failed.",
    };
  }

  // Facebook
  try {
    const fbTokens = await facebookService.getTokens(userId);
    if (!fbTokens) {
      results.facebook = {
        success: false,
        skipped: true,
        message: "Skipped: Facebook account not connected.",
      };
    } else if (facebookService.isTokenExpired(fbTokens.expires_at)) {
      results.facebook = {
        success: false,
        skipped: true,
        message: "Skipped: Facebook token expired. Reconnect Facebook.",
      };
    } else {
      let pageId = facebookPageId;
      if (!pageId) {
        const fallbackPage = await pool.query(
          "SELECT page_id FROM facebook_pages WHERE user_id = $1 ORDER BY id ASC LIMIT 1",
          [userId],
        );
        pageId = fallbackPage.rows[0]?.page_id;
      }

      if (!pageId) {
        results.facebook = {
          success: false,
          skipped: true,
          message: "Skipped: No Facebook page is connected/selected.",
        };
      } else {
        const pageResult = await pool.query(
          "SELECT page_access_token FROM facebook_pages WHERE user_id = $1 AND page_id = $2",
          [userId, pageId],
        );
        const page = pageResult.rows[0];
        if (!page) {
          results.facebook = {
            success: false,
            skipped: true,
            message: "Skipped: Selected Facebook page is invalid.",
          };
        } else {
          let fbPost;
          if (finalType === "photo") {
            const photoSource = remoteMediaUrl || filePath;
            if (!photoSource) {
              results.facebook = {
                success: false,
                skipped: true,
                message:
                  "Skipped: Photo post needs an uploaded file or media URL for Facebook.",
              };
            } else {
              fbPost = await facebookService.publishPhoto(
                page.page_access_token,
                pageId,
                text,
                photoSource,
              );
            }
          } else if (finalType === "video") {
            const facebookVideoSource = remoteMediaUrl || filePath;
            if (!facebookVideoSource) {
              results.facebook = {
                success: false,
                skipped: true,
                message:
                  "Skipped: Facebook video requires an uploaded file or a video URL.",
              };
            } else {
              fbPost = await facebookService.publishVideo(
                page.page_access_token,
                pageId,
                text,
                facebookVideoSource,
              );
            }
          } else {
            fbPost = await facebookService.publishPost(
              page.page_access_token,
              pageId,
              text,
            );
          }

          if (fbPost && !results.facebook.success) {
            results.facebook = {
              success: true,
              skipped: false,
              message: "Posted successfully.",
              postId: fbPost.id,
            };
          }
        }
      }
    }
  } catch (error) {
    results.facebook = {
      success: false,
      skipped: false,
      message: error.message || "Facebook posting failed.",
    };
  }

  // WhatsApp support removed from multi-platform posting

  // YouTube
  let downloadedYoutubeFilePath = null;
  try {
    if (finalType !== "video") {
      results.youtube = {
        success: false,
        skipped: true,
        message: "Skipped: YouTube posting requires video content type.",
      };
    } else {
      let youtubeFilePath = filePath;

      if (!youtubeFilePath && remoteMediaUrl) {
        downloadedYoutubeFilePath =
          await downloadRemoteVideoToTempFile(remoteMediaUrl);
        youtubeFilePath = downloadedYoutubeFilePath;
      }

      if (!youtubeFilePath) {
        results.youtube = {
          success: false,
          skipped: true,
          message:
            "Skipped: Upload a video file or provide a direct video URL for YouTube.",
        };
      } else {
        const uploaded = await uploadVideo(userId, {
          filePath: youtubeFilePath,
          title: String(youtubeTitle || text).slice(0, 100),
          description: String(youtubeDescription || text),
          privacyStatus: ["private", "unlisted", "public"].includes(
            youtubePrivacyStatus,
          )
            ? youtubePrivacyStatus
            : "unlisted",
        });
        results.youtube = {
          success: true,
          skipped: false,
          message: "Video uploaded successfully.",
          videoId: uploaded.id,
          videoUrl: uploaded.url,
        };
      }
    }
  } catch (error) {
    results.youtube = {
      success: false,
      skipped: false,
      message: error.message || "YouTube upload failed.",
    };
  } finally {
    if (downloadedYoutubeFilePath) {
      try {
        await fs.unlink(downloadedYoutubeFilePath);
      } catch {}
    }
  }

  const keys = ["linkedin", "facebook", "youtube"];
  const successCount = keys.filter((key) => results[key].success).length;
  const skippedCount = keys.filter((key) => results[key].skipped).length;

  return {
    results,
    summary: {
      successCount,
      skippedCount,
      failedCount: keys.length - successCount - skippedCount,
    },
  };
}
