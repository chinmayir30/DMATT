import { useState, useEffect } from 'react';
import { getGoogleAuthUrl, getGoogleOAuthStatus, disconnectGoogleAccount } from '../services/api';
import './GoogleAccountPage.css';

function GoogleAccountPage() {
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);

  // Check OAuth status on component mount
  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getGoogleOAuthStatus();
      setStatus(response.data);
    } catch (err) {
      console.error('Failed to check Google OAuth status:', err);
      setError(err.message);
      setStatus({ connected: false });
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    try {
      setConnecting(true);
      setError(null);

      // Open OAuth flow in popup window
      const width = 600;
      const height = 700;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;

      // Open a blank popup immediately (avoids popup blockers)
      const popup = window.open(
        'about:blank',
        'Google OAuth',
        `width=${width},height=${height},left=${left},top=${top},toolbar=no,location=no,directories=no,status=no,menubar=no,scrollbars=yes,resizable=yes,copyhistory=no`
      );

      if (!popup) {
        throw new Error('Popup blocked. Please allow popups for this site and try again.');
      }

      popup.document.title = 'Connecting...';
      popup.document.body.innerHTML = `
        <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial; padding:24px;">
          <h2 style="margin:0 0 8px 0;">Connecting to Google…</h2>
          <p style="margin:0; color:#555;">This window will redirect to Google sign-in shortly.</p>
        </div>
      `;

      // Get OAuth URL and redirect the popup
      const response = await getGoogleAuthUrl();
      const authUrl = response.data.authUrl;
      popup.location.href = authUrl;

      // Poll to check if popup is closed
      const pollTimer = setInterval(async () => {
        if (popup.closed) {
          clearInterval(pollTimer);
          setConnecting(false);
          // Refresh status after OAuth flow completes
          await checkStatus();
        }
      }, 500);
    } catch (err) {
      console.error('Failed to initiate Google OAuth:', err);
      const msg = err.message || 'Failed to initiate Google OAuth';
      setError(msg);
      try {
        const popup = window.open('', 'Google OAuth');
        if (popup && !popup.closed) {
          popup.document.title = 'Connection failed';
          popup.document.body.innerHTML = `
            <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial; padding:24px;">
              <h2 style="margin:0 0 8px 0; color:#b00020;">Connection failed</h2>
              <p style="margin:0; color:#555;">${msg.replaceAll('<','&lt;').replaceAll('>','&gt;')}</p>
              <p style="margin-top:16px; color:#777; font-size:12px;">This window will close automatically.</p>
            </div>
          `;
          setTimeout(() => {
            try { popup.close(); } catch {}
          }, 2500);
        }
      } catch {}
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect your Google account? This will remove access to Google Search Console and Analytics data.')) {
      return;
    }

    try {
      setDisconnecting(true);
      setError(null);
      await disconnectGoogleAccount();
      await checkStatus();
    } catch (err) {
      console.error('Failed to disconnect Google account:', err);
      setError(err.message);
    } finally {
      setDisconnecting(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  if (loading) {
    return (
      <div className="google-account-page">
        <div className="loading">Loading Google account status...</div>
      </div>
    );
  }

  return (
    <div className="google-account-page">
      <div className="page-header">
        <h1>Google Account Integration</h1>
        <p className="page-description">
          Connect your Google account to enable SEO tracking and analytics features
        </p>
      </div>

      {error && (
        <div className="error-message">
          <strong>Error:</strong> {error}
        </div>
      )}

      {status?.connected ? (
        <div className="account-card connected">
          <div className="card-header">
            <div className="status-badge connected">
              <span className="status-dot"></span>
              Connected
            </div>
            <h2>Google Account Connected</h2>
          </div>

          <div className="card-content">
            <div className="info-grid">
              <div className="info-item">
                <label>Status</label>
                <span className={`status-text ${status.isExpired ? 'expired' : 'active'}`}>
                  {status.isExpired ? 'Token Expired (will auto-refresh)' : 'Active'}
                </span>
              </div>

              <div className="info-item">
                <label>Token Expiry</label>
                <span>{formatDate(status.tokenExpiry)}</span>
              </div>

              <div className="info-item">
                <label>Connected Since</label>
                <span>{formatDate(status.connectedAt)}</span>
              </div>

              <div className="info-item">
                <label>Last Updated</label>
                <span>{formatDate(status.lastUpdated)}</span>
              </div>

              {status.scope && (
                <div className="info-item full-width">
                  <label>Permissions Granted</label>
                  <div className="permissions-list">
                    {status.scope.includes('webmasters.readonly') && (
                      <span className="permission-badge">
                        📊 Google Search Console (Read Only)
                      </span>
                    )}
                    {status.scope.includes('analytics.readonly') && (
                      <span className="permission-badge">
                        📈 Google Analytics (Read Only)
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="card-actions">
              <button
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="btn btn-danger"
              >
                {disconnecting ? 'Disconnecting...' : 'Disconnect Google Account'}
              </button>
              <button
                onClick={checkStatus}
                className="btn btn-secondary"
              >
                Refresh Status
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="account-card disconnected">
          <div className="card-header">
            <div className="status-badge disconnected">
              <span className="status-dot"></span>
              Not Connected
            </div>
            <h2>Connect Your Google Account</h2>
          </div>

          <div className="card-content">
            <p className="info-text">
              To enable SEO tracking and analytics features, you need to connect your Google account.
              This will grant DMAT read-only access to:
            </p>

            <ul className="features-list">
              <li>
                <strong>Google Search Console</strong>
                <p>Track keyword rankings, impressions, clicks, and CTR for your landing pages</p>
              </li>
              <li>
                <strong>Google Analytics (GA4)</strong>
                <p>Monitor website traffic, user behavior, and conversion metrics</p>
              </li>
            </ul>

            <div className="security-note">
              <h3>🔒 Security & Privacy</h3>
              <ul>
                <li>We only request <strong>read-only</strong> access to your data</li>
                <li>You can revoke access at any time</li>
                <li>Your credentials are securely encrypted</li>
                <li>We never share your data with third parties</li>
              </ul>
            </div>

            <div className="card-actions">
              <button
                onClick={handleConnect}
                disabled={connecting}
                className="btn btn-primary btn-large"
              >
                {connecting ? 'Opening Google Login...' : 'Connect Google Account'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="help-section">
        <h3>Need Help?</h3>
        <details>
          <summary>What permissions does DMAT request?</summary>
          <p>
            DMAT requests read-only access to Google Search Console and Google Analytics.
            This allows us to fetch SEO data and analytics for your websites without the
            ability to modify any settings or data.
          </p>
        </details>
        <details>
          <summary>Is my data secure?</summary>
          <p>
            Yes! We use industry-standard OAuth 2.0 for authentication, and all tokens
            are encrypted in our database. We never store your Google password.
          </p>
        </details>
        <details>
          <summary>Can I revoke access later?</summary>
          <p>
            Absolutely! You can disconnect your Google account at any time using the
            "Disconnect" button above. You can also revoke access directly from your
            Google Account settings.
          </p>
        </details>
      </div>
    </div>
  );
}

export default GoogleAccountPage;
