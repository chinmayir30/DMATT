import { useEffect, useState } from "react";
import {
  getFacebookPages,
  getLinkedInStatus,
  getYouTubeStatus,
  getLinkedInAuthUrl,
  getFacebookAuthUrl,
  getYouTubeAuthUrl,
  syncFacebookPages,
  postToAllSocialPlatforms,
  getScheduledPosts,
  createScheduledPost,
  cancelScheduledPost,
} from "../services/api";
import "./SocialHubPage.css";

function SocialHubPage() {
  const [content, setContent] = useState("");
  const [contentType, setContentType] = useState("text");
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaFile, setMediaFile] = useState(null);
  const [facebookPages, setFacebookPages] = useState([]);
  const [facebookPageId, setFacebookPageId] = useState("");
  const [linkedinStatus, setLinkedinStatus] = useState(null);
  const [youtubeStatus, setYoutubeStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [youtubeTitle, setYoutubeTitle] = useState("");
  const [youtubeDescription, setYoutubeDescription] = useState("");
  const [youtubePrivacyStatus, setYoutubePrivacyStatus] = useState("unlisted");
  const [scheduledAt, setScheduledAt] = useState("");
  const [scheduledPosts, setScheduledPosts] = useState([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);

  const loadScheduled = async () => {
    try {
      const data = await getScheduledPosts();
      const list = data?.posts || [];
      setScheduledPosts(
        list.filter((p) => p.status === "pending" || p.status === "processing"),
      );
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        const [fbData, liData, ytData] = await Promise.all([
          getFacebookPages().catch(() => ({ pages: [] })),
          getLinkedInStatus().catch(() => ({ connected: false })),
          getYouTubeStatus().catch(() => ({ connected: false })),
        ]);

        const pages = fbData?.pages || [];
        setFacebookPages(pages);
        setFacebookPageId(pages[0]?.page_id || "");
        setLinkedinStatus(liData || { connected: false });
        setYoutubeStatus(ytData || { connected: false });
      } catch (e) {
        setError("Failed to load Social Hub metadata.");
      }
    };

    loadData();
    loadScheduled();
  }, []);

  const handleConnectLinkedIn = async () => {
    try {
      const data = await getLinkedInAuthUrl();
      window.location.href = data.authorizationUrl;
    } catch (err) {
      setError(err.message || 'Failed to start LinkedIn connect');
    }
  };

  const handleConnectFacebook = async () => {
    try {
      const data = await getFacebookAuthUrl();
      window.location.href = data.authorizationUrl;
    } catch (err) {
      setError(err.message || 'Failed to start Facebook connect');
    }
  };

  const handleConnectYouTube = async () => {
    try {
      const data = await getYouTubeAuthUrl();
      window.location.href = data.authUrl || data.authorizationUrl;
    } catch (err) {
      setError(err.message || 'Failed to start YouTube connect');
    }
  };

  const buildFormData = () => {
    const formData = new FormData();
    formData.append("content", content);
    formData.append("contentType", contentType);
    formData.append("mediaUrl", mediaUrl || "");
    formData.append("youtubeTitle", youtubeTitle || "");
    formData.append("youtubeDescription", youtubeDescription || "");
    formData.append("youtubePrivacyStatus", youtubePrivacyStatus || "unlisted");
    if (facebookPageId) {
      formData.append("facebookPageId", facebookPageId);
    }
    if (mediaFile) {
      formData.append("media", mediaFile);
    }
    return formData;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim()) {
      setError("Post content is required.");
      return;
    }
    if (
      (contentType === "photo" || contentType === "video") &&
      !mediaFile &&
      !mediaUrl.trim()
    ) {
      setError("Please upload a media file or provide a direct media URL.");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await postToAllSocialPlatforms(buildFormData());
      setResult(response?.data || null);
    } catch (err) {
      setError(err.message || "Failed to publish across platforms.");
    } finally {
      setLoading(false);
    }
  };

  const handleSchedule = async (e) => {
    e.preventDefault();
    if (!content.trim()) {
      setError("Post content is required.");
      return;
    }
    if (
      (contentType === "photo" || contentType === "video") &&
      !mediaFile &&
      !mediaUrl.trim()
    ) {
      setError("Please upload a media file or provide a direct media URL.");
      return;
    }
    if (!scheduledAt) {
      setError("Choose a date and time for scheduling.");
      return;
    }
    const when = new Date(scheduledAt);
    if (Number.isNaN(when.getTime())) {
      setError("Invalid schedule date/time.");
      return;
    }
    if (when.getTime() <= Date.now() + 60_000) {
      setError("Schedule time must be at least 1 minute in the future.");
      return;
    }

    setScheduleLoading(true);
    setError("");
    try {
      const formData = buildFormData();
      formData.append("scheduledAt", when.toISOString());
      await createScheduledPost(formData);
      setScheduledAt("");
      setMediaFile(null);
      await loadScheduled();
    } catch (err) {
      setError(err.message || "Failed to schedule post.");
    } finally {
      setScheduleLoading(false);
    }
  };

  const handleCancelSchedule = async (id) => {
    try {
      await cancelScheduledPost(id);
      await loadScheduled();
    } catch (err) {
      setError(err.message || "Failed to cancel schedule.");
    }
  };

  const renderResult = () => {
    if (!result?.results) return null;
    const keys = ["linkedin", "facebook", "youtube"];
    return (
      <div className="social-hub-result">
        <h3>Publish Result</h3>
        <p>
          Success: {result.summary?.successCount ?? 0}, Skipped:{" "}
          {result.summary?.skippedCount ?? 0}, Failed:{" "}
          {result.summary?.failedCount ?? 0}
        </p>
        <div className="result-grid">
          {keys.map((key) => {
            const item = result.results[key];
            const className = item.success
              ? "ok"
              : item.skipped
                ? "skipped"
                : "failed";
            return (
              <div className={`result-card ${className}`} key={key}>
                <div className="result-title">{key.toUpperCase()}</div>
                <div className="result-message">{item.message}</div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="social-hub-page">
      <div className="social-hub-header">
        <h1>Social Hub - One Click Multi-Post</h1>
        <p>
          Write once and publish to all connected platforms together. Schedule
          posts for later.
        </p>
      </div>

      {error && <div className="social-hub-error">{error}</div>}

      <form className="social-hub-form" onSubmit={handleSubmit}>
        <div className="social-hub-field">
          <label>Content Type</label>
          <select
            value={contentType}
            onChange={(e) => setContentType(e.target.value)}
          >
            <option value="text">Text</option>
            <option value="photo">Photo</option>
            <option value="video">Video</option>
          </select>
        </div>

        <div className="social-hub-field">
          <label>Post Content *</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={6}
            placeholder="Write one post for all social platforms..."
          />
        </div>

        {(contentType === "photo" || contentType === "video") && (
          <>
            <div className="social-hub-field">
              <label>Media URL</label>
              <input
                type="url"
                value={mediaUrl}
                onChange={(e) => setMediaUrl(e.target.value)}
                placeholder="https://example.com/media.jpg or video.mp4"
              />
            </div>
            <div className="social-hub-field">
              <label>
                Upload Media File{" "}
                {contentType === "video"
                  ? "(optional if you provide a direct video URL)"
                  : "(optional)"}
              </label>
              <input
                type="file"
                accept={contentType === "photo" ? "image/*" : "video/*"}
                onChange={(e) => setMediaFile(e.target.files?.[0] || null)}
              />
            </div>
          </>
        )}

        <div className="social-hub-field">
          <label>Facebook</label>
          <div className="social-hub-platform-row">
            {facebookPages.length > 0 ? (
              <select
                value={facebookPageId}
                onChange={(e) => setFacebookPageId(e.target.value)}
              >
                {facebookPages.map((page) => (
                  <option value={page.page_id} key={page.page_id}>
                    {page.page_name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value="Not connected"
                readOnly
              />
            )}
            {!facebookPages[0] ? (
              <button type="button" className="btn btn-connect" onClick={handleConnectFacebook}>
                Connect Facebook
              </button>
            ) : (
              <button type="button" className="btn btn-small" onClick={syncFacebookPages}>
                Sync Pages
              </button>
            )}
          </div>
        </div>

        <div className="social-hub-field">
          <label>LinkedIn</label>
          <div className="social-hub-platform-row">
            <input
              type="text"
              value={linkedinStatus?.connected ? "Connected" : "Not connected"}
              readOnly
            />
            {!linkedinStatus?.connected ? (
              <button type="button" className="btn btn-connect" onClick={handleConnectLinkedIn}>
                Connect LinkedIn
              </button>
            ) : (
              <button type="button" className="btn btn-small" onClick={() => { /* placeholder for profile */ }}>
                Manage
              </button>
            )}
          </div>
        </div>

        <div className="social-hub-field">
          <label>YouTube</label>
          <div className="social-hub-platform-row">
            <input
              type="text"
              value={
                youtubeStatus?.connected
                  ? youtubeStatus.channelName || "Connected"
                  : "Not connected"
              }
              readOnly
            />
            {!youtubeStatus?.connected ? (
              <button type="button" className="btn btn-connect" onClick={handleConnectYouTube}>
                Connect YouTube
              </button>
            ) : (
              <button type="button" className="btn btn-small" onClick={() => {}}>
                Manage
              </button>
            )}
          </div>
        </div>

        {contentType === "video" && (
          <>
            <div className="social-hub-field">
              <label>YouTube Title</label>
              <input
                type="text"
                value={youtubeTitle}
                onChange={(e) => setYoutubeTitle(e.target.value)}
                placeholder="Video title for YouTube"
              />
            </div>
            <div className="social-hub-field">
              <label>YouTube Description</label>
              <textarea
                rows={3}
                value={youtubeDescription}
                onChange={(e) => setYoutubeDescription(e.target.value)}
                placeholder="Video description"
              />
            </div>
            <div className="social-hub-field">
              <label>YouTube Privacy</label>
              <select
                value={youtubePrivacyStatus}
                onChange={(e) => setYoutubePrivacyStatus(e.target.value)}
              >
                <option value="private">Private</option>
                <option value="unlisted">Unlisted</option>
                <option value="public">Public</option>
              </select>
            </div>
          </>
        )}

        <div className="social-hub-field">
          <label>Schedule for later (optional)</label>
          <input
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
          />
          <span className="social-hub-hint">
            Pick a future time, then use &quot;Schedule post&quot; below.
          </span>
        </div>

        <div className="social-hub-actions">
          <button type="submit" disabled={loading || !content.trim()}>
            {loading ? "Posting to all..." : "Post to All Platforms"}
          </button>
          <button
            type="button"
            className="secondary"
            disabled={scheduleLoading || !content.trim()}
            onClick={handleSchedule}
          >
            {scheduleLoading ? "Scheduling…" : "Schedule post"}
          </button>
        </div>
      </form>

      {scheduledPosts.length > 0 && (
        <div className="social-hub-scheduled">
          <h3>Upcoming scheduled posts</h3>
          <ul className="social-hub-scheduled-list">
            {scheduledPosts.map((p) => (
              <li key={p.id}>
                <div>
                  <strong>
                    {p.scheduled_at
                      ? new Date(p.scheduled_at).toLocaleString()
                      : "—"}
                  </strong>
                  <span className="social-hub-scheduled-status">
                    {p.status}
                  </span>
                </div>
                <div className="social-hub-scheduled-preview">
                  {(p.content || "").slice(0, 120)}
                  {(p.content || "").length > 120 ? "…" : ""}
                </div>
                {p.status === "pending" && (
                  <button
                    type="button"
                    className="link-cancel"
                    onClick={() => handleCancelSchedule(p.id)}
                  >
                    Cancel
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {renderResult()}
    </div>
  );
}

export default SocialHubPage;
