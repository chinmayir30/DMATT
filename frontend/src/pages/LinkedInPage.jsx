import { useState, useEffect } from 'react';
import {
  getLinkedInStatus,
  getLinkedInAuthUrl,
  disconnectLinkedIn,
  publishLinkedInPost,
  getLinkedInPosts,
  getLinkedInStats
} from '../services/api';
import './LinkedInPage.css';

function LinkedInPage() {
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
const [openComments, setOpenComments] = useState({});
  // Post composer state
  const [postContent, setPostContent] = useState('');
  const [contentType, setContentType] = useState('text');
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaFile, setMediaFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [publishing, setPublishing] = useState(false);

  // Post history state
  const [posts, setPosts] = useState([]);
  const [postStats, setPostStats] = useState(null);
  const [loadingPosts, setLoadingPosts] = useState(false);


  useEffect(() => {
    checkConnectionStatus();

    // Check for OAuth callback success/error
    const params = new URLSearchParams(window.location.search);
    if (params.get('success') === 'true') {
      setSuccess('LinkedIn account connected successfully!');
      checkConnectionStatus();
      window.history.replaceState({}, '', '/linkedin');
    } else if (params.get('error')) {
      setError(decodeURIComponent(params.get('error')));
      window.history.replaceState({}, '', '/linkedin');
    }
  }, []);

  useEffect(() => {
    if (connectionStatus?.connected) {
      loadPostHistory();
      loadPostStats();
    }
  }, [connectionStatus]);

  const checkConnectionStatus = async () => {
    try {
      setLoading(true);
      const data = await getLinkedInStatus();
      setConnectionStatus(data);
    } catch (err) {
      setError('Failed to check LinkedIn connection status');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    try {
      setError(null);
      const data = await getLinkedInAuthUrl();

      // Redirect to LinkedIn OAuth
      window.location.href = data.authorizationUrl;
    } catch (err) {
      setError(err.message || 'Failed to initiate LinkedIn connection');
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect your LinkedIn account?')) {
      return;
    }

    try {
      setError(null);
      await disconnectLinkedIn();
      setSuccess('LinkedIn account disconnected');
      setConnectionStatus(null);
      setPosts([]);
      setPostStats(null);
    } catch (err) {
      setError(err.message || 'Failed to disconnect LinkedIn account');
    }
  };

  const buildFormData = () => {
    const formData = new FormData();
    formData.append('content', postContent);
    formData.append('contentType', contentType);
    formData.append('mediaUrl', mediaUrl || '');
    if (mediaFile) {
      formData.append('media', mediaFile);
    }
    return formData;
  };

  const handlePublishPost = async (e) => {
    e.preventDefault();

    if (!postContent.trim()) {
      setError('Post content cannot be empty');
      return;
    }

    if (postContent.length > 3000) {
      setError('Post content exceeds 3000 character limit');
      return;
    }

    try {
      setPublishing(true);
      setError(null);

      await publishLinkedInPost(buildFormData());

      setSuccess('Post published successfully!');
      setPostContent('');
      setMediaUrl('');
      setMediaFile(null);
      setImagePreview(null);
      setContentType('text');

      // Reload post history and stats
      await loadPostHistory();
      await loadPostStats();
    } catch (err) {
      setError(err.message || 'Failed to publish post');
    } finally {
      setPublishing(false);
    }
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

  const loadPostHistory = async () => {
    try {
      setLoadingPosts(true);
      const data = await getLinkedInPosts();
      const loadedPosts = data.posts || [];
      setPosts(loadedPosts);
      updateStatsFromPosts(loadedPosts, data.pagination);
    } catch (err) {
      console.error('Failed to load post history:', err);
    } finally {
      setLoadingPosts(false);
    }
  };

  const countValue = (value, fallback = 0) => (
    typeof value === 'number' && Number.isFinite(value) ? value : fallback
  );

  const displayEngagementValue = (value, unavailable) => (
    unavailable ? 'N/A' : countValue(value)
  );

  const updateStatsFromPosts = (loadedPosts, pagination) => {
    const engagementUnavailable = loadedPosts.some((post) => post.engagementUnavailable);
    const totalLikes = loadedPosts.reduce((sum, post) => sum + countValue(post.likesCount), 0);
    const totalComments = loadedPosts.reduce(
      (sum, post) => sum + countValue(post.commentsCount, post.comments?.length || 0),
      0,
    );
    const totalShares = loadedPosts.reduce((sum, post) => sum + countValue(post.sharesCount), 0);

    setPostStats((current) => ({
      ...current,
      totalPosts: pagination?.totalCount ?? current?.totalPosts ?? loadedPosts.length,
      postsLast30Days: current?.postsLast30Days ?? loadedPosts.length,
      totalLikes: engagementUnavailable ? null : totalLikes,
      totalComments: engagementUnavailable ? null : totalComments,
      totalShares: engagementUnavailable ? null : totalShares,
      engagementUnavailable,
      engagementPermissionDenied:
        loadedPosts.some((post) => post.engagementPermissionDenied) || current?.engagementPermissionDenied,
      engagementError:
        loadedPosts.find((post) => post.engagementError)?.engagementError || current?.engagementError,
    }));
  };

  const loadPostStats = async () => {
    try {
      const data = await getLinkedInStats();
      setPostStats((current) => ({
        ...data,
        totalLikes:
          data.engagementUnavailable || current?.engagementUnavailable
            ? null
            : Math.max(countValue(data.totalLikes), countValue(current?.totalLikes)),
        totalComments:
          data.engagementUnavailable || current?.engagementUnavailable
            ? null
            : Math.max(countValue(data.totalComments), countValue(current?.totalComments)),
        totalShares:
          data.engagementUnavailable || current?.engagementUnavailable
            ? null
            : Math.max(countValue(data.totalShares), countValue(current?.totalShares)),
        engagementUnavailable: data.engagementUnavailable || current?.engagementUnavailable,
        engagementPermissionDenied: data.engagementPermissionDenied || current?.engagementPermissionDenied,
        engagementError: data.engagementError || current?.engagementError,
      }));
    } catch (err) {
      console.error('Failed to load post stats:', err);
    }
  };

  if (loading) {
    return (
      <div className="linkedin-page">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="linkedin-page">
      <div className="page-header">
        <h1>LinkedIn Publishing</h1>
        <p>Publish content directly to your LinkedIn profile</p>
      </div>

      {error && (
        <div className="alert alert-error">
          <span className="alert-icon">⚠️</span>
          {error}
          <button className="alert-close" onClick={() => setError(null)}>×</button>
        </div>
      )}

      {success && (
        <div className="alert alert-success">
          <span className="alert-icon">✓</span>
          {success}
          <button className="alert-close" onClick={() => setSuccess(null)}>×</button>
        </div>
      )}

      {/* Connection Status Card */}
      <div className="card connection-card">
        <h2>Connection Status</h2>

        {!connectionStatus?.connected ? (
          <div className="connection-disconnected">
            <div className="status-icon">🔗</div>
            <p>LinkedIn account not connected</p>
            <button className="btn btn-primary" onClick={handleConnect}>
              Connect LinkedIn Account
            </button>
          </div>
        ) : (
          <div className="connection-connected">
            <div className="status-badge">
              <span className="status-dot"></span>
              Connected
            </div>
            <div className="connection-info">
              <p><strong>Account:</strong> {connectionStatus.linkedinUserName}</p>
              {connectionStatus.linkedinUserEmail && (
                <p><strong>Email:</strong> {connectionStatus.linkedinUserEmail}</p>
              )}
              <p><strong>Connected:</strong> {new Date(connectionStatus.connectedAt).toLocaleDateString()}</p>
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
                  <div className="stat-value">{displayEngagementValue(postStats.totalLikes, postStats.engagementUnavailable)}</div>
                  <div className="stat-label">Total Likes</div>
                </div>
                <div className="stat-item">
                  <div className="stat-value">{displayEngagementValue(postStats.totalComments, postStats.engagementUnavailable)}</div>
                  <div className="stat-label">Total Comments</div>
                </div>
                <div className="stat-item">
                  <div className="stat-value">{displayEngagementValue(postStats.totalShares, postStats.engagementUnavailable)}</div>
                  <div className="stat-label">Total Shares</div>
                </div>
                
              </div>
            )}
            <button className="btn btn-secondary" onClick={handleDisconnect}>
              Disconnect
            </button>
          </div>
        )}
      </div>

      {/* Post Composer (only show if connected) */}
      {connectionStatus?.connected && (
        <div className="card composer-card">
          <h2>Create Post</h2>
          <form onSubmit={handlePublishPost}>
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
                placeholder="What do you want to share? (Max 3000 characters)"
                maxLength="3000"
              />
              <div className="char-count">
                {postContent.length} / 3000 characters
              </div>
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
              type="submit"
              className="btn btn-primary"
              disabled={publishing || !postContent.trim()}
            >
              {publishing ? 'Publishing...' : 'Publish to LinkedIn'}
            </button>
          </form>
        </div>
      )}

      {/* Post History (only show if connected) */}
      {connectionStatus?.connected && (
        <div className="card history-card">
          <h2>Post History</h2>

          {loadingPosts ? (
            <div className="loading">Loading posts...</div>
          ) : posts.length === 0 ? (
            <div className="empty-state">
              <p>No posts yet. Create your first post above!</p>
            </div>
          ) : (
            <div className="posts-list">
              {posts.map((post) => {
                
                const likesCount = post.likesCount ?? 0;
                const commentsCount = countValue(post.commentsCount, post.comments?.length || 0);
                const sharesCount = countValue(post.sharesCount);
                const engagementUnavailable = !!post.engagementUnavailable;
                const likesDisplay = likesCount ?? 0
commentsCount ?? 0
sharesCount ?? 0;
                const commentsDisplay = likesCount ?? 0
commentsCount ?? 0
sharesCount ?? 0;
                const sharesDisplay = likesCount ?? 0
commentsCount ?? 0
sharesCount ?? 0;

                return (
                <div
                  key={post.id}
                  className="post-item"
                  
                >
                  <div className="post-header">
                    <span className="post-date">
                      {new Date(post.published_at).toLocaleString()}
                    </span>
                    {post.post_url && (
                      <a
                        href={post.post_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="post-link"
                        onClick={(event) => event.stopPropagation()}
                      >
                        View on LinkedIn →
                      </a>
                    )}
                  </div>
                  <div className="post-content">
                    {post.post_content}
                  </div>

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

  <span className="engagement-pill">
    {engagementUnavailable ? 'N/A' : likesCount} Likes
  </span>

  <span
    className="engagement-pill engagement-pill-clickable"
    onClick={(e) => {
      e.stopPropagation();
      setOpenComments(prev => ({
        ...prev,
        [post.id]: !prev[post.id]
      }));
    }}
  >
    {engagementUnavailable ? 'N/A' : commentsCount} Comments
  </span>

  <span className="engagement-pill">
    {engagementUnavailable ? 'N/A' : sharesCount} Shares
  </span>
</div>

                  
                </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default LinkedInPage;
