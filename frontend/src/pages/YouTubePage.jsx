import { useState, useEffect } from "react";
import {
  getYouTubeStatus,
  getYouTubeVideos,
  getYouTubeAuthUrl,
  uploadYouTubeVideo,
  getYouTubeStats,
  disconnectYouTube,
} from "../services/api";
import "./YouTubePage.css";

export default function YouTubePage() {
  const [status, setStatus] = useState(null);
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [youtubeStats, setYoutubeStats] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [openComments, setOpenComments] = useState({});

  const [form, setForm] = useState({
    title: "",
    description: "",
    privacyStatus: "unlisted",
    file: null,
  });

  // ================= FETCH STATUS & VIDEOS =================
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("success") === "true") {
      setSuccess("YouTube account connected successfully!");
      window.history.replaceState({}, "", "/youtube");
    } else if (params.get("error")) {
      setError(decodeURIComponent(params.get("error")));
      window.history.replaceState({}, "", "/youtube");
    }

    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      setUploadResult(null);

      const statusRes = await getYouTubeStatus();
      setStatus(statusRes);

      if (!statusRes?.connected) {
        setVideos([]);
        setYoutubeStats(null);
        return;
      }

      try {
        const statsRes = await getYouTubeStats();
        setYoutubeStats(statsRes);
      } catch (err) {
        console.error("Stats fetching failed", err);
      }

      const videosRes = await getYouTubeVideos();
      setVideos(videosRes.videos || []);
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to load YouTube data");
    } finally {
      setLoading(false);
    }
  };

  // ================= GOOGLE / YOUTUBE OAUTH =================
  const handleConnectGoogle = async () => {
    try {
      setError(null);

      const res = await getYouTubeAuthUrl();
      const authUrl =
        res?.authorizationUrl ||
        res?.authUrl ||
        res?.data?.authorizationUrl ||
        res?.data?.authUrl;

      if (!authUrl) {
        throw new Error("Authorization URL not received from server.");
      }

      window.location.href = authUrl;
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to connect to Google");
    }
  };

  const handleDisconnect = async () => {
    if (
      !window.confirm(
        "Are you sure you want to disconnect your YouTube account?",
      )
    ) {
      return;
    }

    try {
      setError(null);
      await disconnectYouTube();
      setSuccess("YouTube account disconnected");
      setStatus(null);
      setVideos([]);
      setYoutubeStats(null);
    } catch (err) {
      setError(err.message || "Failed to disconnect YouTube account");
    }
  };

  // ================= VIDEO UPLOAD =================
  const handleUpload = async () => {
    try {
      setError(null);
      setUploadResult(null);

      if (!form.file) {
        setError("Please select a video file.");
        return;
      }

      setUploading(true);

      const result = await uploadYouTubeVideo({
        file: form.file,
        title: form.title,
        description: form.description,
        privacyStatus: form.privacyStatus,
      });

      setUploadResult(result);
      setForm({
        title: "",
        description: "",
        privacyStatus: "unlisted",
        file: null,
      });

      await fetchData(); // Refresh videos list
    } catch (err) {
      console.error(err);
      setError(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return <div className="page-container">Loading YouTube data...</div>;
  }

  const canUpload = !!status?.connected;
  const formatCount = (value) => (
    value === null || value === undefined ? "N/A" : Number(value || 0).toLocaleString()
  );

  return (
    <div className="youtube-page page-container">
      {/* ================= HEADER ================= */}
      <div className="page-header">
        <h1>🎬 YouTube Integration</h1>
        <p>Upload and manage videos directly from your dashboard</p>
      </div>

      {success && (
        <div
          className="alert alert-success"
          style={{
            padding: 15,
            background: "#e8f5e9",
            color: "#2e7d32",
            marginBottom: 20,
            borderRadius: 4,
          }}
        >
          {success}
          <button
            style={{
              float: "right",
              border: "none",
              background: "none",
              cursor: "pointer",
            }}
            onClick={() => setSuccess(null)}
          >
            ×
          </button>
        </div>
      )}

      {/* ================= ERROR MESSAGE ================= */}
      {error && (
        <div className="card" style={{ borderLeft: "4px solid #e53935" }}>
          <strong style={{ color: "#e53935" }}>Error:</strong> {error}
        </div>
      )}

      {/* ================= CONNECTION STATUS ================= */}
      <div className="card connection-card">
        <h2>Connection Status</h2>

        {!status?.connected ? (
          <div
            className="connection-disconnected"
            style={{ textAlign: "center", padding: "20px 0" }}
          >
            <div
              className="status-icon"
              style={{ fontSize: 40, marginBottom: 15 }}
            >
              🔗
            </div>
            <p>YouTube account not connected</p>
            <p style={{ color: "#666", fontSize: 14 }}>
              Connect your Google account to enable YouTube uploads and
              analytics.
            </p>
            <button
              onClick={handleConnectGoogle}
              className="btn btn-primary"
              style={{ marginTop: 10 }}
            >
              🔐 Connect / Reconnect YouTube
            </button>
          </div>
        ) : (
          <div className="connection-connected">
            <div
              className="status-badge connected"
              style={{
                display: "inline-block",
                background: "#e8f5e9",
                color: "#2e7d32",
                padding: "5px 12px",
                borderRadius: 15,
                fontSize: 14,
                fontWeight: 500,
                marginBottom: 15,
              }}
            >
              <span className="status-dot"></span>
              Connected
            </div>

            <div
              className="connection-info"
              style={{ marginBottom: 20, lineHeight: 1.6 }}
            >
              <p>
                <strong>Account:</strong>{" "}
                {status.youtubeUserName || "Connected Account"}
              </p>
              {status.youtubeUserEmail && (
                <p>
                  <strong>Email:</strong> {status.youtubeUserEmail}
                </p>
              )}
              {status.connectedAt && (
                <p>
                  <strong>Connected:</strong>{" "}
                  {new Date(status.connectedAt).toLocaleDateString()}
                </p>
              )}
            </div>

            {youtubeStats && (
              <div
                className="post-stats"
                style={{
                  display: "flex",
                  gap: 15,
                  marginBottom: 25,
                  flexWrap: "wrap",
                }}
              >
                <div
                  className="stat-item"
                  style={{
                    flex: 1,
                    minWidth: 120,
                    padding: 15,
                    background: "#f8f9fa",
                    borderRadius: 8,
                    textAlign: "center",
                    border: "1px solid #eee",
                  }}
                >
                  <div
                    className="stat-value"
                    style={{
                      fontSize: 24,
                      fontWeight: "bold",
                      color: "#e53935",
                    }}
                  >
                    {youtubeStats.totalPosts}
                  </div>
                  <div
                    className="stat-label"
                    style={{
                      fontSize: 12,
                      color: "#666",
                      textTransform: "uppercase",
                      marginTop: 5,
                    }}
                  >
                    Total Videos
                  </div>
                </div>
                <div
                  className="stat-item"
                  style={{
                    flex: 1,
                    minWidth: 120,
                    padding: 15,
                    background: "#f8f9fa",
                    borderRadius: 8,
                    textAlign: "center",
                    border: "1px solid #eee",
                  }}
                >
                  <div
                    className="stat-value"
                    style={{
                      fontSize: 24,
                      fontWeight: "bold",
                      color: "#e53935",
                    }}
                  >
                    {youtubeStats.postsLast30Days}
                  </div>
                  <div
                    className="stat-label"
                    style={{
                      fontSize: 12,
                      color: "#666",
                      textTransform: "uppercase",
                      marginTop: 5,
                    }}
                  >
                    Total Views
                  </div>
                </div>
                <div
                  className="stat-item"
                  style={{
                    flex: 1,
                    minWidth: 120,
                    padding: 15,
                    background: "#f8f9fa",
                    borderRadius: 8,
                    textAlign: "center",
                    border: "1px solid #eee",
                  }}
                >
                  <div
                    className="stat-value"
                    style={{
                      fontSize: 24,
                      fontWeight: "bold",
                      color: "#e53935",
                    }}
                  >
                    {youtubeStats.totalLikes ?? 0}
                  </div>
                  <div
                    className="stat-label"
                    style={{
                      fontSize: 12,
                      color: "#666",
                      textTransform: "uppercase",
                      marginTop: 5,
                    }}
                  >
                    Total Likes
                  </div>
                </div>
                <div
                  className="stat-item"
                  style={{
                    flex: 1,
                    minWidth: 120,
                    padding: 15,
                    background: "#f8f9fa",
                    borderRadius: 8,
                    textAlign: "center",
                    border: "1px solid #eee",
                  }}
                >
                  <div
                    className="stat-value"
                    style={{
                      fontSize: 24,
                      fontWeight: "bold",
                      color: "#e53935",
                    }}
                  >
                    {youtubeStats.totalComments ?? 0}
                  </div>
                  <div
                    className="stat-label"
                    style={{
                      fontSize: 12,
                      color: "#666",
                      textTransform: "uppercase",
                      marginTop: 5,
                    }}
                  >
                    Total Comments
                  </div>
                </div>
                <div
                  className="stat-item"
                  style={{
                    flex: 1,
                    minWidth: 120,
                    padding: 15,
                    background: "#f8f9fa",
                    borderRadius: 8,
                    textAlign: "center",
                    border: "1px solid #eee",
                  }}
                >
                  <div
                    className="stat-value"
                    style={{
                      fontSize: 24,
                      fontWeight: "bold",
                      color: "#e53935",
                    }}
                  >
                    {formatCount(youtubeStats.totalShares)}
                  </div>
                  <div
                    className="stat-label"
                    style={{
                      fontSize: 12,
                      color: "#666",
                      textTransform: "uppercase",
                      marginTop: 5,
                    }}
                  >
                    Shares
                  </div>
                </div>
              </div>
            )}

            <button
              className="btn btn-secondary"
              onClick={handleDisconnect}
              style={{
                background: "#f44336",
                color: "white",
                padding: "8px 16px",
                border: "none",
                borderRadius: 4,
                cursor: "pointer",
              }}
            >
              Disconnect
            </button>
          </div>
        )}
      </div>

      {/* ================= UPLOAD FORM ================= */}
      {canUpload && (
        <div className="card">
          <h2>Upload a Video</h2>

          <div className="form-group">
            <label>Video File</label>
            <input
              type="file"
              accept="video/*"
              className="form-control"
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  file: e.target.files?.[0] || null,
                }))
              }
            />
          </div>

          <div className="form-group">
            <label>Title</label>
            <input
              type="text"
              className="form-control"
              value={form.title}
              onChange={(e) =>
                setForm((f) => ({ ...f, title: e.target.value }))
              }
              placeholder="Enter video title"
            />
          </div>

          <div className="form-group">
            <label>Description</label>
            <textarea
              className="form-control"
              rows="4"
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  description: e.target.value,
                }))
              }
              placeholder="Enter video description"
            />
          </div>

          <div className="form-group">
            <label>Privacy</label>
            <select
              className="form-control"
              value={form.privacyStatus}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  privacyStatus: e.target.value,
                }))
              }
            >
              <option value="private">Private</option>
              <option value="unlisted">Unlisted</option>
              <option value="public">Public</option>
            </select>
          </div>

          <button
            className="btn btn-primary"
            onClick={handleUpload}
            disabled={uploading || !form.file}
          >
            {uploading ? "Uploading…" : "🚀 Upload to YouTube"}
          </button>

          {uploadResult?.url && (
            <div style={{ marginTop: 15 }}>
              <strong>Uploaded Successfully:</strong>{" "}
              <a href={uploadResult.url} target="_blank" rel="noreferrer">
                View Video
              </a>
            </div>
          )}
        </div>
      )}

      {/* ================= VIDEOS LIST ================= */}
      <div className="card videos-card">
        <h2>📊 Recent Videos</h2>

        {videos.length === 0 ? (
          <p>No videos found.</p>
        ) : (
          <div className="videos-list">
            {videos.map((vid) => {
              const likesCount = Number(vid.likesCount || 0);
              const commentsCount = Number(vid.commentsCount || 0);

              return (
              <div
                key={vid.id}
                className="video-item"
              >
                {/* Thumbnail */}
                {vid.thumbnailUrl && (
                  <img
                    src={vid.thumbnailUrl}
                    alt={vid.title}
                    className="video-thumbnail"
                  />
                )}

                <div className="video-info">
                  <h4>{vid.title}</h4>

                  <div className="video-meta">
                    <span>👀 Views: {Number(vid.views).toLocaleString()}</span>
                    <span>
                      📅 Published:{" "}
                      {new Date(vid.publishedAt).toLocaleDateString()}
                    </span>
                    <span>
                      <a
                        href={`https://www.youtube.com/watch?v=${vid.id}`}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(event) => event.stopPropagation()}
                      >
                        ▶ Watch
                      </a>
                    </span>
                  </div>

                  <div className="post-engagement-toggle">
                    <span>View engagement</span>
                    <span className="engagement-pill">{likesCount.toLocaleString()} Likes</span>
                    <span
                      className="engagement-pill engagement-pill-clickable"
                      onClick={() => setOpenComments((prev) => ({ ...prev, [vid.id]: !prev[vid.id] }))}
                    >
                      {commentsCount.toLocaleString()} Comments
                    </span>
                    <span className="engagement-pill">{formatCount(vid.sharesCount)} Shares</span>
                  </div>

                  {openComments[vid.id] && (
                    <div className="post-engagement-comments">
                      {vid.comments?.length ? (
                        <div className="comment-list">
                          {vid.comments.map((c) => (
                            <div key={c.id || `${vid.id}-${c.message}`} className="comment-item">
                              <div className="comment-meta">
                                <strong>{c.fromName || "User"}:</strong>
                              </div>
                              <div className="comment-message">{c.message}</div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="comment-empty muted">
                          No comments yet
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
