// API service for backend communication

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5001";

// Helper function to get auth token from localStorage
const getAuthToken = () => {
  return localStorage.getItem("token");
};

// Helper function to handle API responses
const handleResponse = async (response) => {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({
      message: `HTTP error! status: ${response.status}`,
    }));

    // Backend sends errors in format: { success: false, error: { message: "...", code: "..." } }
    // Or sometimes just { message: "..." }
    const errorMessage =
      errorData.error?.message ||
      errorData.message ||
      `HTTP error! status: ${response.status}`;
    throw new Error(errorMessage);
  }
  return response.json();
};

// Helper function to make authenticated requests
const fetchWithAuth = async (url, options = {}) => {
  const token = getAuthToken();
  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${url}`, {
    ...options,
    headers,
  });

  return handleResponse(response);
};

/**
 * Get backend health status
 */
export const getHealth = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/health`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Error fetching health status:", error);
    throw error;
  }
};

/**
 * Check database connection
 */
export const getDbStatus = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/db-check`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Error fetching database status:", error);
    throw error;
  }
};

// ============================================================================
// AUTHENTICATION APIs
// ============================================================================

/**
 * Login user
 * @param {string} email
 * @param {string} password
 * @returns {Promise<Object>} { token, user }
 */
export const login = async (email, password) => {
  const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  const data = await handleResponse(response);

  // Store token in localStorage
  if (data.data && data.data.token) {
    localStorage.setItem("token", data.data.token);
    localStorage.setItem("user", JSON.stringify(data.data.user));
  }

  return data.data;
};

/**
 * Verify current token
 */
export const verifyToken = async () => {
  return await fetchWithAuth("/api/auth/verify");
};

/**
 * Logout user
 */
export const logout = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
};

/**
 * Get current user from localStorage
 */
export const getCurrentUser = () => {
  const userStr = localStorage.getItem("user");
  return userStr ? JSON.parse(userStr) : null;
};

// ============================================================================
// LANDING PAGES APIs
// ============================================================================

/**
 * Get all landing pages
 * @param {Object} params - Query parameters (status, search, page, limit)
 */
export const getLandingPages = async (params = {}) => {
  const queryString = new URLSearchParams(params).toString();
  const url = `/api/admin/landing-pages${queryString ? `?${queryString}` : ""}`;
  return await fetchWithAuth(url);
};

/**
 * Get single landing page by ID
 * @param {number} id
 */
export const getLandingPage = async (id) => {
  return await fetchWithAuth(`/api/admin/landing-pages/${id}`);
};

/**
 * Create new landing page
 * @param {Object} data - Landing page data
 */
export const createLandingPage = async (data) => {
  return await fetchWithAuth("/api/admin/landing-pages", {
    method: "POST",
    body: JSON.stringify(data),
  });
};

/**
 * Update landing page
 * @param {number} id
 * @param {Object} data - Updated landing page data
 */
export const updateLandingPage = async (id, data) => {
  return await fetchWithAuth(`/api/admin/landing-pages/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
};

/**
 * Publish landing page
 * @param {number} id
 */
export const publishLandingPage = async (id) => {
  return await fetchWithAuth(`/api/admin/landing-pages/${id}/publish`, {
    method: "POST",
  });
};

/**
 * Delete landing page
 * @param {number} id
 */
export const deleteLandingPage = async (id) => {
  return await fetchWithAuth(`/api/admin/landing-pages/${id}`, {
    method: "DELETE",
  });
};

/**
 * Get landing page preview
 * @param {number} id
 */
export const getPreview = async (id) => {
  const token = getAuthToken();
  // Add cache-busting timestamp to force fresh preview every time
  const cacheBuster = `?t=${Date.now()}`;
  const response = await fetch(
    `${API_BASE_URL}/api/admin/landing-pages/${id}/preview${cacheBuster}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store", // Disable browser caching
    },
  );

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return await response.text(); // Returns HTML
};

/**
 * Get landing page stats
 */
export const getLandingPageStats = async () => {
  return await fetchWithAuth("/api/admin/landing-pages/stats");
};

// ============================================================================
// LEADS APIs
// ============================================================================

/**
 * Get all leads
 * @param {Object} params - Query parameters (status, search, page, limit, landingPageId)
 */
export const getLeads = async (params = {}) => {
  const queryString = new URLSearchParams(params).toString();
  const url = `/api/admin/leads${queryString ? `?${queryString}` : ""}`;
  return await fetchWithAuth(url);
};

/**
 * Get single lead by ID
 * @param {number} id
 */
export const getLead = async (id) => {
  return await fetchWithAuth(`/api/admin/leads/${id}`);
};

/**
 * Update lead status
 * @param {number} id
 * @param {string} status - One of: new, contacted, qualified, converted
 */
export const updateLeadStatus = async (id, status) => {
  return await fetchWithAuth(`/api/admin/leads/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
};

/**
 * Export leads to CSV
 * @param {Object} params - Query parameters (status, search, landingPageId)
 */
export const exportLeads = async (params = {}) => {
  const token = getAuthToken();
  const queryString = new URLSearchParams(params).toString();
  const url = `${API_BASE_URL}/api/admin/leads/export${queryString ? `?${queryString}` : ""}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  // Return the blob for download
  return await response.blob();
};

/**
 * Assign lead to user
 * @param {number} id - Lead ID
 * @param {number|null} assigned_to - User ID to assign to (null to unassign)
 */
export const assignLead = async (id, assigned_to) => {
  return await fetchWithAuth(`/api/admin/leads/${id}/assign`, {
    method: "PATCH",
    body: JSON.stringify({ assigned_to }),
  });
};

/**
 * Get all notes for a lead
 * @param {number} id - Lead ID
 */
export const getLeadNotes = async (id) => {
  return await fetchWithAuth(`/api/admin/leads/${id}/notes`);
};

/**
 * Create a new note for a lead
 * @param {number} id - Lead ID
 * @param {string} note_text - Note content
 */
export const createLeadNote = async (id, note_text) => {
  return await fetchWithAuth(`/api/admin/leads/${id}/notes`, {
    method: "POST",
    body: JSON.stringify({ note_text }),
  });
};

/**
 * Delete a lead note
 * @param {number} noteId - Note ID
 */
export const deleteLeadNote = async (noteId) => {
  return await fetchWithAuth(`/api/admin/leads/notes/${noteId}`, {
    method: "DELETE",
  });
};

/**
 * Submit lead (public endpoint - no auth required)
 * @param {Object} data - Lead data
 */
export const submitLead = async (data) => {
  const response = await fetch(`${API_BASE_URL}/api/public/leads`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  return handleResponse(response);
};

// ============================================================================
// USERS APIs
// ============================================================================

/**
 * Get all users
 */
export const getUsers = async () => {
  return await fetchWithAuth("/api/admin/users");
};

/**
 * Get single user by ID
 * @param {number} id
 */
export const getUser = async (id) => {
  return await fetchWithAuth(`/api/admin/users/${id}`);
};

/**
 * Create new user
 * @param {Object} data - User data (name, email, password, role)
 */
export const createUser = async (data) => {
  return await fetchWithAuth("/api/admin/users", {
    method: "POST",
    body: JSON.stringify(data),
  });
};

/**
 * Update user
 * @param {number} id
 * @param {Object} data - Updated user data (name, email, role)
 */
export const updateUser = async (id, data) => {
  return await fetchWithAuth(`/api/admin/users/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
};

/**
 * Delete user
 * @param {number} id
 */
export const deleteUser = async (id) => {
  return await fetchWithAuth(`/api/admin/users/${id}`, {
    method: "DELETE",
  });
};

// ============================================================================
// ANALYTICS APIs
// ============================================================================

/**
 * Get dashboard analytics data
 */
export const getDashboardAnalytics = async () => {
  return await fetchWithAuth("/api/admin/analytics/dashboard");
};

// ============================================================================
// TEMPLATES APIs
// ============================================================================

/**
 * Get all active templates
 */
export const getTemplates = async () => {
  return await fetchWithAuth("/api/admin/templates");
};

/**
 * Get single template by ID
 * @param {number} id
 */
export const getTemplate = async (id) => {
  return await fetchWithAuth(`/api/admin/templates/${id}`);
};

// ============================================================================
// IMAGE UPLOAD APIs
// ============================================================================

/**
 * Upload image to MinIO storage
 * @param {File} imageFile - Image file to upload
 * @returns {Promise<Object>} - {url, filename, size, mimeType}
 */
export const uploadImage = async (imageFile) => {
  const token = getAuthToken();
  const formData = new FormData();
  formData.append("image", imageFile);

  const response = await fetch(`${API_BASE_URL}/api/admin/upload/image`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData, // Don't set Content-Type - browser will set it with boundary
  });

  return handleResponse(response);
};

/**
 * Delete image from MinIO storage
 * @param {string} imageUrl - URL of the image to delete
 */
export const deleteImage = async (imageUrl) => {
  return await fetchWithAuth("/api/admin/upload/image", {
    method: "DELETE",
    body: JSON.stringify({ url: imageUrl }),
  });
};

// ============================================================================
// GOOGLE OAUTH APIs (Phase 3 - SEO Engine)
// ============================================================================

/**
 * Get Google OAuth authorization URL
 * @returns {Promise<Object>} - {authUrl}
 */
export const getGoogleAuthUrl = async () => {
  const token = getAuthToken();
  return { authorizationUrl: `${API_BASE_URL}/api/social-oauth/google?token=${token}` };
};

/**
 * Get YouTube-specific OAuth authorization URL (creates server session cookie)
 * Uses credentials to ensure session cookie is set by backend.
 */
export const getYouTubeAuthUrl = async () => {
  const token = getAuthToken();
  return { authorizationUrl: `${API_BASE_URL}/api/social-oauth/google?token=${token}` };
};

/**
 * Check Google OAuth connection status
 * @returns {Promise<Object>} - {connected, tokenExpiry, isExpired, scope}
 */
export const getGoogleOAuthStatus = async () => {
  return await fetchWithAuth("/api/admin/google/oauth/status");
};

/**
 * Disconnect Google account (revoke access)
 * @returns {Promise<Object>}
 */
export const disconnectGoogleAccount = async () => {
  return await fetchWithAuth("/api/admin/google/oauth/disconnect", {
    method: "DELETE",
  });
};

// ============================================================================
// SEARCH CONSOLE APIs (Phase 3 - Task 3)
// ============================================================================

/**
 * Get list of Search Console sites
 * @returns {Promise<Object>}
 */
export const getSearchConsoleSites = async () => {
  return await fetchWithAuth("/api/admin/seo/search-console/sites");
};

/**
 * Sync keyword data from Search Console
 * @param {Object} data - { siteUrl, startDate, endDate }
 * @returns {Promise<Object>}
 */
export const syncKeywords = async (data) => {
  return await fetchWithAuth("/api/admin/seo/search-console/sync", {
    method: "POST",
    body: JSON.stringify(data),
  });
};

/**
 * Get keyword performance data
 * @param {Object} params - Query parameters
 * @returns {Promise<Object>}
 */
export const getKeywords = async (params = {}) => {
  const queryString = new URLSearchParams(params).toString();
  const url = `/api/admin/seo/keywords${queryString ? `?${queryString}` : ""}`;
  return await fetchWithAuth(url);
};

/**
 * Get top performing keywords
 * @param {Object} params - { limit, sortBy, days }
 * @returns {Promise<Object>}
 */
export const getTopKeywords = async (params = {}) => {
  const queryString = new URLSearchParams(params).toString();
  const url = `/api/admin/seo/keywords/top${queryString ? `?${queryString}` : ""}`;
  return await fetchWithAuth(url);
};

/**
 * Get declining keywords
 * @param {Object} params - { limit, days }
 * @returns {Promise<Object>}
 */
export const getDecliningKeywords = async (params = {}) => {
  const queryString = new URLSearchParams(params).toString();
  const url = `/api/admin/seo/keywords/declining${queryString ? `?${queryString}` : ""}`;
  return await fetchWithAuth(url);
};

/**
 * Get keyword trend data
 * @param {string} keyword - Keyword to get trend for
 * @param {number} days - Number of days
 * @returns {Promise<Object>}
 */
export const getKeywordTrend = async (keyword, days = 30) => {
  return await fetchWithAuth(
    `/api/admin/seo/keywords/${encodeURIComponent(keyword)}/trend?days=${days}`,
  );
};

/**
 * Export keywords to CSV
 * @param {Object} params - Query parameters
 * @returns {Promise<Blob>}
 */
export const exportKeywords = async (params = {}) => {
  const token = getAuthToken();
  const queryString = new URLSearchParams(params).toString();
  const url = `${API_BASE_URL}/api/admin/seo/keywords/export${queryString ? `?${queryString}` : ""}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return await response.blob();
};

/**
 * Get indexing issues
 * @param {Object} params - Query parameters
 * @returns {Promise<Object>}
 */
export const getIndexingIssues = async (params = {}) => {
  const queryString = new URLSearchParams(params).toString();
  const url = `/api/admin/seo/indexing-issues${queryString ? `?${queryString}` : ""}`;
  return await fetchWithAuth(url);
};

// ============================================================================
// GOOGLE ANALYTICS (GA4) APIs (Phase 3 - Task 4)
// ============================================================================

/**
 * Get list of GA4 properties
 * @returns {Promise<Object>}
 */
export const getGA4Properties = async () => {
  return await fetchWithAuth("/api/admin/ga4/properties");
};

/**
 * Add a GA4 property
 * @param {Object} propertyData - Property information
 * @returns {Promise<Object>}
 */
export const addGA4Property = async (propertyData) => {
  return await fetchWithAuth("/api/admin/ga4/properties", {
    method: "POST",
    body: JSON.stringify(propertyData),
  });
};

/**
 * Sync GA4 analytics data
 * @param {Object} data - Sync parameters
 * @returns {Promise<Object>}
 */
export const syncGA4Analytics = async (data) => {
  return await fetchWithAuth("/api/admin/ga4/sync", {
    method: "POST",
    body: JSON.stringify(data),
  });
};

/**
 * Get GA4 metrics
 * @param {Object} params - Query parameters
 * @returns {Promise<Object>}
 */
export const getGA4Metrics = async (params = {}) => {
  const queryString = new URLSearchParams(params).toString();
  const url = `/api/admin/ga4/metrics${queryString ? `?${queryString}` : ""}`;
  return await fetchWithAuth(url);
};

/**
 * Get GA4 page views
 * @param {Object} params - Query parameters
 * @returns {Promise<Object>}
 */
export const getGA4PageViews = async (params = {}) => {
  const queryString = new URLSearchParams(params).toString();
  const url = `/api/admin/ga4/page-views${queryString ? `?${queryString}` : ""}`;
  return await fetchWithAuth(url);
};

/**
 * Get GA4 events
 * @param {Object} params - Query parameters
 * @returns {Promise<Object>}
 */
export const getGA4Events = async (params = {}) => {
  const queryString = new URLSearchParams(params).toString();
  const url = `/api/admin/ga4/events${queryString ? `?${queryString}` : ""}`;
  return await fetchWithAuth(url);
};

/**
 * Get GA4 analytics dashboard
 * @param {Object} params - Query parameters
 * @returns {Promise<Object>}
 */
export const getGA4Dashboard = async (params = {}) => {
  const queryString = new URLSearchParams(params).toString();
  const url = `/api/admin/ga4/dashboard${queryString ? `?${queryString}` : ""}`;
  return await fetchWithAuth(url);
};

// ============================================================================
// SEO DASHBOARD APIs
// ============================================================================

/**
 * Get unified SEO dashboard
 * @param {number} days - Number of days to look back (default 30)
 * @returns {Promise<Object>}
 */
export const getSeoDashboard = async (days = 30) => {
  const url = `/api/admin/seo-dashboard?days=${days}`;
  return await fetchWithAuth(url);
};

// ============================================================================
// LINKEDIN APIs (Phase 4 - Social Publishing)
// ============================================================================

/**
 * Get LinkedIn OAuth authorization URL
 * @returns {Promise<Object>} - {authorizationUrl}
 */
export const getLinkedInAuthUrl = async () => {
  const token = getAuthToken();
  return { authorizationUrl: `${API_BASE_URL}/api/social-oauth/linkedin?token=${token}` };
};

/**
 * Check LinkedIn connection status
 * @returns {Promise<Object>} - {connected, linkedinUserName, linkedinUserEmail, connectedAt}
 */
export const getLinkedInStatus = async () => {
  return await fetchWithAuth("/api/admin/linkedin/status");
};

/**
 * Disconnect LinkedIn account
 * @returns {Promise<Object>}
 */
export const disconnectLinkedIn = async () => {
  return await fetchWithAuth("/api/admin/linkedin/disconnect", {
    method: "POST",
  });
};

/**
 * Publish post to LinkedIn
 * @param {FormData} data - FormData with content, contentType, mediaUrl, media file
 * @returns {Promise<Object>}
 */
export const publishLinkedInPost = async (data) => {
  const token = getAuthToken();
  const headers = {};

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  // Don't set Content-Type - let browser handle multipart/form-data
  const response = await fetch(`${API_BASE_URL}/api/admin/linkedin/posts`, {
    method: "POST",
    headers,
    body: data,
  });

  return handleResponse(response);
};

/**
 * Get LinkedIn post history
 * @returns {Promise<Object>} - {posts}
 */
export const getLinkedInPosts = async () => {
  return await fetchWithAuth("/api/admin/linkedin/posts");
};

/**
 * Get LinkedIn post statistics
 * @returns {Promise<Object>} - {totalPosts, postsLast30Days}
 */
export const getLinkedInStats = async () => {
  return await fetchWithAuth("/api/admin/linkedin/stats");
};
// =======================
// Facebook APIs
// =======================

export const getFacebookAuthUrl = async () => {
  const token = getAuthToken();
  return { authorizationUrl: `${API_BASE_URL}/api/social-oauth/facebook?token=${token}` };
};
export const getFacebookPages = async () => {
  return await fetchWithAuth("/api/admin/facebook/pages");
};

/**
 * Publish post to Facebook
 * @param {FormData} data - FormData with message, contentType, mediaUrl, media file, pageId
 * @returns {Promise<Object>}
 */
export const publishFacebookPost = async (data) => {
  const token = getAuthToken();
  const headers = {};

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  // Don't set Content-Type - let browser handle multipart/form-data
  const response = await fetch(`${API_BASE_URL}/api/admin/facebook/posts`, {
    method: "POST",
    headers,
    body: data,
  });

  return handleResponse(response);
};
//new
export const getFacebookStatus = async () => {
  return await fetchWithAuth("/api/admin/facebook/status");
};

export const getFacebookStats = async () => {
  return await fetchWithAuth("/api/admin/facebook/stats");
};
//new
export const getFacebookPosts = async () => {
  return await fetchWithAuth("/api/admin/facebook/posts");
};

export const getFacebookDiagnostics = async () => {
  return await fetchWithAuth("/api/admin/facebook/diagnostics");
};

// WhatsApp APIs removed

// =======================
// YouTube APIs
// =======================

export const getYouTubeStatus = async () => {
  return await fetchWithAuth("/api/admin/youtube/status", { credentials: "include" });
};

export const getYouTubeStats = async () => {
  return await fetchWithAuth("/api/admin/youtube/stats");
};

export const getYouTubeVideos = async () => {
  return await fetchWithAuth("/api/admin/youtube/videos", { credentials: "include" });
};

export const disconnectYouTube = async () => {
  return await fetchWithAuth("/api/admin/youtube/disconnect", {
    method: "POST",
    credentials: "include"
  });
};

export const uploadYouTubeVideo = async ({
  file,
  title,
  description,
  privacyStatus = "unlisted",
}) => {
  const token = getAuthToken();
  const formData = new FormData();
  formData.append("video", file);
  formData.append("title", title || "");
  formData.append("description", description || "");
  formData.append("privacyStatus", privacyStatus || "unlisted");

  const response = await fetch(`${API_BASE_URL}/api/admin/youtube/upload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    credentials: "include",
    body: formData,
  });

  return handleResponse(response);
};

// Instagram APIs
// =======================

// Chatbot removed

export const disconnectFacebook = async () => {
  return await fetchWithAuth("/api/admin/facebook/disconnect", {
    method: "POST",
  });
};

export const syncFacebookPages = async () => {
  return await fetchWithAuth("/api/admin/facebook/sync-pages", {
    method: "POST",
  });
};

export const postToAllSocialPlatforms = async (payload) => {
  const token = getAuthToken();
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const response = await fetch(
    `${API_BASE_URL}/api/admin/social-hub/post-all`,
    {
      method: "POST",
      headers,
      body: payload,
    },
  );
  return handleResponse(response);
};

export const getScheduledPosts = async () => {
  return await fetchWithAuth("/api/admin/scheduled-posts");
};

export const createScheduledPost = async (formData) => {
  const token = getAuthToken();
  const response = await fetch(`${API_BASE_URL}/api/admin/scheduled-posts`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  return handleResponse(response);
};

export const cancelScheduledPost = async (id) => {
  return await fetchWithAuth(`/api/admin/scheduled-posts/${id}`, {
    method: "DELETE",
  });
};
