import { useState, useEffect } from "react";
import {
  publishFacebookPost,
  getFacebookAuthUrl,
  getFacebookPages,
  getFacebookStatus,
  getFacebookStats,
  getFacebookPosts,
  disconnectFacebook,
  syncFacebookPages,
  getFacebookDiagnostics,
} from "../services/api";
import "./FacebookPage.css";

export default function FacebookPage() {
  const [postContent, setPostContent] = useState("");
  const [pages, setPages] = useState([]);
  const [selectedPage, setSelectedPage] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [postStats, setPostStats] = useState(null);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [postHistory, setPostHistory] = useState([]);
  const [openComments, setOpenComments] = useState({});
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [diagnostics, setDiagnostics] = useState(null);
  const [syncing, setSyncing] = useState(false);
  
  // Media upload states
  const [contentType, setContentType] = useState('text');
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaFile, setMediaFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);

  useEffect(() => {
    checkConnection();
  }, []);
  const checkConnection = async () => {
    try {
      setCheckingStatus(true);

      const status = await getFacebookStatus();
      setConnectionStatus(status);
      console.log('✅ Facebook connection status:', status);

      if (status.connected) {
        // Sync pages first
        console.log('🔄 Syncing Facebook pages...');
        try {
          await syncFacebookPages();
        } catch (syncError) {
          console.error('⚠️ Sync error (non-fatal):', syncError);
          // Continue anyway - pages might still be available
        }
        
        // Then fetch pages
        const pagesLoaded = await fetchPages();
        
        // If pages are empty, show helpful message
        if (!pagesLoaded || pages.length === 0) {
          console.warn('⚠️ Connected but no pages found');
          setMessage("Facebook connected but no pages found. Please sync pages manually.");
        }

        const stats = await getFacebookStats();
        setPostStats(stats);

        const history = await getFacebookPosts();
        setPostHistory(history.posts || []);
      }
    } catch (error) {
      console.error('❌ Error checking Facebook connection:', error);
    } finally {
      setCheckingStatus(false);
    }
  };

  const handleDisconnect = async () => {
    if (
      !confirm(
        "Are you sure you want to disconnect your Facebook account? This will remove access to Facebook pages and posting.",
      )
    )
      return;
    try {
      setMessage("Disconnecting...");
      await disconnectFacebook();
      setConnectionStatus({ connected: false });
      setPages([]);
      setPostStats(null);
      setPostHistory([]);
      setMessage("Facebook account disconnected.");
    } catch (err) {
      setMessage(err.message || "Failed to disconnect Facebook account");
    }
  };

  const fetchPages = async () => {
    try {
      const data = await getFacebookPages();
      console.log('📄 Facebook pages received:', data);
      
      if (!data.pages || data.pages.length === 0) {
        console.warn('⚠️ No pages returned. This might mean pages need to be synced.');
        setMessage("No Facebook pages found. Try clicking 'Sync Pages' to refresh.");
        return false;
      }
      
      setPages(data.pages || []);
      
      // Auto-select "Innovate Electronics" page or the first page
      if (data.pages?.length > 0) {
        const innovateElectronicsPage = data.pages.find(
          (p) => p.page_name?.toLowerCase().includes("innovate") && 
                 p.page_name?.toLowerCase().includes("electronics")
        );
        
        if (innovateElectronicsPage) {
          setSelectedPage(innovateElectronicsPage.page_id);
        } else {
          // Default to first page if Innovate Electronics not found
          setSelectedPage(data.pages[0].page_id);
        }
      }
      return true;
    } catch (error) {
      console.error('❌ Error fetching Facebook pages:', error);
      setMessage(`Failed to fetch pages: ${error.message}`);
      return false;
    }
  };

  const handleSyncPages = async () => {
    try {
      setSyncing(true);
      setMessage("Syncing Facebook pages...");
      console.log('🔄 Initiating Facebook pages sync...');
      
      await syncFacebookPages();
      
      // Refresh pages after sync
      const success = await fetchPages();
      
      if (success) {
        setMessage("✅ Facebook pages synced successfully!");
      } else {
        setMessage("Pages synced but none are available. Please reconnect your account.");
      }
    } catch (error) {
      console.error('❌ Error syncing pages:', error);
      setMessage(`Failed to sync pages: ${error.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const loadDiagnostics = async () => {
    try {
      const data = await getFacebookDiagnostics();
      setDiagnostics(data.diagnostics);
      setShowDiagnostics(true);
    } catch (error) {
      console.error('Error loading diagnostics:', error);
      setMessage(`Failed to load diagnostics: ${error.message}`);
    }
  };

  const handleConnect = async () => {
    try {
      const data = await getFacebookAuthUrl();
      window.location.href = data.authorizationUrl;
    } catch (error) {
      setMessage(error.message || "Authentication failed.");
    }
  };

  const buildFormData = () => {
    const formData = new FormData();
    formData.append('message', postContent);
    formData.append('contentType', contentType);
    formData.append('mediaUrl', mediaUrl || '');
    formData.append('pageId', selectedPage);
    if (mediaFile) {
      formData.append('media', mediaFile);
    }
    return formData;
  };

  const handleMediaChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setMediaFile(file);
      // Create preview for image
      if (contentType === 'photo') {
        const reader = new FileReader();
        reader.onload = (event) => {
          setImagePreview(event.target?.result);
        };
        reader.readAsDataURL(file);
      } else {
        setImagePreview(null);
      }
    }
  };

  const handlePublish = async () => {
    if (!postContent.trim()) {
      setMessage("Post content cannot be empty.");
      return;
    }

    // Auto-selected page should always be available
    if (!selectedPage) {
      setMessage("Please connect a Facebook account first.");
      return;
    }

    try {
      setLoading(true);
      setMessage("");

      await publishFacebookPost(buildFormData());

      setMessage("Post published successfully!");
      setPostContent("");
      setMediaUrl("");
      setMediaFile(null);
      setImagePreview(null);
      setContentType('text');
      
      // Reload post history
      const history = await getFacebookPosts();
      setPostHistory(history.posts || []);
      const stats = await getFacebookStats();
      setPostStats(stats);
    } catch (error) {
      setMessage(error.message || "Failed to publish post.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="linkedin-page">
      <div className="page-header">
        <h1>Facebook Publishing</h1>
        <p>Publish content directly to your Facebook page</p>
      </div>

      {message && (
        <div className="alert alert-success">
          <span className="alert-icon">✓</span>
          {message}
          <button className="alert-close" onClick={() => setMessage("")}>
            ×
          </button>
        </div>
      )}

      {/* Connection Status Card */}
      <div className="card">
        <h2>Connection Status</h2>

        {!connectionStatus?.connected ? (
          <div className="connection-disconnected">
            <div className="status-icon">🔗</div>
            <p>Facebook account not connected</p>
            <button className="btn btn-primary" onClick={handleConnect}>
              Connect Facebook Account
            </button>
          </div>
        ) : (
          <div className="connection-connected">
            <div className="status-badge">
              <span className="status-dot"></span>
              Connected
            </div>

            <div className="connection-info">
              <p>
                <strong>Account:</strong> {connectionStatus.facebookUserName}
              </p>

              {connectionStatus.facebookUserEmail && (
                <p>
                  <strong>Email:</strong> {connectionStatus.facebookUserEmail}
                </p>
              )}

              <p>
                <strong>Connected:</strong>{" "}
                {connectionStatus.connectedAt
                  ? new Date(connectionStatus.connectedAt).toLocaleDateString()
                  : "N/A"}
              </p>

              <p>
                <strong>Pages Connected:</strong> {pages.length}
              </p>
            </div>

            {postStats && (
              <div className="post-stats">
                <div className="stat-item">
                  <div className="stat-value">{postStats.totalPosts}</div>
                  <div className="stat-label">Total Posts</div>
                </div>

                <div className="stat-item">
                  <div className="stat-value">{postStats.postsLast30Days}</div>
                  <div className="stat-label">Last 30 Days</div>
                </div>
                <div className="stat-item">
                  <div className="stat-value">{postStats.totalLikes ?? 0}</div>
                  <div className="stat-label">Total Likes</div>
                </div>
                <div className="stat-item">
                  <div className="stat-value">{postStats.totalComments ?? 0}</div>
                  <div className="stat-label">Total Comments</div>
                </div>
                <div className="stat-item">
                  <div className="stat-value">{postStats.totalShares ?? 0}</div>
                  <div className="stat-label">Total Shares</div>
                </div>
              </div>
            )}
            <div style={{ marginTop: 12, display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button className="btn btn-secondary" onClick={handleSyncPages} disabled={syncing}>
                {syncing ? '🔄 Syncing...' : '🔄 Sync Pages'}
              </button>
              <button className="btn btn-secondary" onClick={loadDiagnostics}>
                🔍 Diagnostics
              </button>
              <button className="btn btn-secondary" onClick={handleDisconnect}>
                Disconnect
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Composer ONLY if connected */}
      {connectionStatus?.connected && (
        <div className="card">
          <h2>Create Post</h2>

          {/* Display selected page name without dropdown */}
          <div className="form-group">
            <label>Publishing to</label>
            <div className="form-control-display" style={{ padding: '10px', backgroundColor: '#f5f5f5', borderRadius: '4px', border: '1px solid #ddd' }}>
              <strong>
                {pages.find(p => p.page_id === selectedPage)?.page_name || 'Innovate Electronics'}
              </strong>
            </div>
          </div>

          <div className="form-group">
            <label>Content Type</label>
            <select
              className="form-control"
              value={contentType}
              onChange={(e) => {
                setContentType(e.target.value);
                setImagePreview(null);
                setMediaFile(null);
                setMediaUrl('');
              }}
            >
              <option value="text">Text</option>
              <option value="photo">Photo</option>
              <option value="video">Video</option>
            </select>
          </div>

          <div className="form-group">
            <label>Post Content *</label>
            <textarea
              className="form-control"
              rows="6"
              value={postContent}
              onChange={(e) => setPostContent(e.target.value)}
              placeholder="What do you want to share?"
            />
          </div>

          {(contentType === 'photo' || contentType === 'video') && (
            <>
              <div className="form-group">
                <label>Media URL (Optional)</label>
                <input
                  type="url"
                  className="form-control"
                  value={mediaUrl}
                  onChange={(e) => setMediaUrl(e.target.value)}
                  placeholder="https://example.com/media.jpg or video.mp4"
                />
              </div>

              <div className="form-group">
                <label>Upload Media File (Optional)</label>
                <input
                  type="file"
                  className="form-control"
                  accept={contentType === 'photo' ? 'image/*' : 'video/*'}
                  onChange={handleMediaChange}
                />
              </div>

              {imagePreview && contentType === 'photo' && (
                <div className="form-group">
                  <label>Preview</label>
                  <div className="image-preview-container">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="image-preview"
                      style={{
                        maxWidth: '100%',
                        maxHeight: '300px',
                        borderRadius: '8px',
                        marginTop: '8px'
                      }}
                    />
                  </div>
                </div>
              )}
            </>
          )}

          <button
            className="btn btn-primary"
            onClick={handlePublish}
            disabled={loading || !postContent.trim()}
          >
            {loading ? "Publishing..." : "Publish to Facebook"}
          </button>
        </div>
      )}
      {connectionStatus?.connected && postHistory.length > 0 && (
        <div className="card">
          <h2>Post History</h2>

          {postHistory.map((post) => {
           
            const likesCount =
              typeof post.likesCount === "number"
                ? post.likesCount
                : post.likedBy?.length || 0;
            const commentsCount =
              typeof post.commentsCount === "number"
                ? post.commentsCount
                : post.comments?.length || 0;
            const sharesCount = typeof post.sharesCount === "number" ? post.sharesCount : 0;

            return (
            <div
              key={post.id}
              className="post-history-item"
            >
              <div className="post-date">
                {new Date(post.created_at).toLocaleString()}
              </div>

              <div className="post-content">{post.message}</div>

              {post.image_url && (
                <div className="post-image" style={{ marginTop: '12px' }}>
                  <img
                    src={post.image_url}
                    alt="Post media"
                    style={{
                      maxWidth: '100%',
                      maxHeight: '400px',
                      borderRadius: '8px',
                      display: 'block'
                    }}
                  />
                </div>
              )}

              <div className="post-engagement-toggle">
                <span>View engagement</span>
                <span className="engagement-pill">{likesCount} Likes</span>
                <span
                  className="engagement-pill engagement-pill-clickable"
                  onClick={() =>
  setOpenComments((prev) => ({
    ...prev,
    [post.id]: !prev[post.id],
  }))
}
                >
                  {commentsCount} Comments
                </span>
                <span className="engagement-pill">{sharesCount} Shares</span>
                
              </div>

              {openComments[post.id] && (
  <div className="post-engagement-comments">
    {post.comments?.length ? (
      <div className="comment-list">
        {post.comments.map((c) => (
          <div key={c.id || `${post.id}-${c.message}`} className="comment-item">
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
            );
          })}
        </div>
      )}

      {/* Diagnostics Modal */}
      {showDiagnostics && diagnostics && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '8px',
            maxWidth: '600px',
            maxHeight: '80vh',
            overflowY: 'auto',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3>Facebook Connection Diagnostics</h3>
              <button
                onClick={() => setShowDiagnostics(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer'
                }}
              >
                ×
              </button>
            </div>

            <div style={{ fontSize: '12px', fontFamily: 'monospace', backgroundColor: '#f5f5f5', padding: '12px', borderRadius: '4px' }}>
              <div style={{ marginBottom: '12px' }}>
                <strong>User ID:</strong> {diagnostics.userId}
              </div>

              <div style={{ marginBottom: '12px' }}>
                <strong>OAuth Tokens:</strong> {diagnostics.checks.tokens?.status}
                {diagnostics.checks.tokens?.data && (
                  <div style={{ marginLeft: '12px', marginTop: '4px' }}>
                    <div>✓ Token exists: Yes</div>
                    <div>✓ Expired: {diagnostics.checks.tokens.data.isExpired ? 'YES' : 'No'}</div>
                    <div>✓ User: {diagnostics.checks.tokens.data.userName}</div>
                    <div>✓ Email: {diagnostics.checks.tokens.data.userEmail}</div>
                  </div>
                )}
                {diagnostics.checks.tokens?.error && (
                  <div style={{ color: 'red', marginLeft: '12px' }}>
                    ✗ Error: {diagnostics.checks.tokens.error}
                  </div>
                )}
              </div>

              <div style={{ marginBottom: '12px' }}>
                <strong>Facebook Pages:</strong> {diagnostics.checks.pages?.status}
                {diagnostics.checks.pages?.count > 0 && (
                  <div style={{ marginLeft: '12px', marginTop: '4px' }}>
                    <div>✓ Count: {diagnostics.checks.pages.count}</div>
                    {diagnostics.checks.pages.pages?.map((p, i) => (
                      <div key={i} style={{ fontSize: '11px', marginTop: '4px' }}>
                        • {p.pageName} (ID: {p.pageId})
                      </div>
                    ))}
                  </div>
                )}
                {diagnostics.checks.pages?.count === 0 && (
                  <div style={{ color: 'red', marginLeft: '12px' }}>
                    ✗ No pages found
                  </div>
                )}
              </div>

              <div style={{ marginBottom: '12px' }}>
                <strong>Posts:</strong> {diagnostics.checks.posts?.count || 0}
              </div>

              <div>
                <strong>Configuration:</strong>
                <div style={{ marginLeft: '12px', marginTop: '4px' }}>
                  <div>✓ Client ID: {diagnostics.checks.config?.facebookClientIdConfigured ? 'Yes' : 'No'}</div>
                  <div>✓ Client Secret: {diagnostics.checks.config?.facebookClientSecretConfigured ? 'Yes' : 'No'}</div>
                  <div style={{ fontSize: '11px', marginTop: '4px' }}>Redirect URI: {diagnostics.checks.config?.redirectUri}</div>
                </div>
              </div>
            </div>

            <div style={{ marginTop: '16px' }}>
              <button
                onClick={() => setShowDiagnostics(false)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
