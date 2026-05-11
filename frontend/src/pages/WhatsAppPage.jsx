import { useState, useEffect } from "react";
import {
  getWhatsAppStatus,
  getWhatsAppMessages,
  getWhatsAppConnectInfo,
  sendWhatsAppMessage,
} from "../services/api";
import "./LinkedInPage.css";
import "./WhatsAppPage.css";

export default function WhatsAppPage() {
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [messages, setMessages] = useState([]);
  const [connectInfo, setConnectInfo] = useState(null);
  const [messageText, setMessageText] = useState("");
  const [toNumber, setToNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async () => {
    try {
      setError(null);
      const [statusRes, infoRes] = await Promise.all([
        getWhatsAppStatus(),
        getWhatsAppConnectInfo(),
      ]);
      setConnectionStatus(statusRes);
      setConnectInfo(infoRes);

      const msgs = await getWhatsAppMessages();
      setMessages(msgs.messages || []);
    } catch (e) {
      console.error(e);
      setError(e.message || "Failed to load WhatsApp status");
    }
  };

  const handleSend = async () => {
    if (!messageText.trim()) {
      setError("Please enter a message.");
      return;
    }
    if (!toNumber.trim()) {
      setError("Enter the recipient WhatsApp number (customer) including country code.");
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await sendWhatsAppMessage({ to: toNumber, message: messageText });
      setSuccess("Message sent successfully.");
      setMessageText("");
      const msgs = await getWhatsAppMessages();
      setMessages(msgs.messages || []);
    } catch (e) {
      setError(e.message || "Failed to send message.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="linkedin-page">
      <div className="page-header">
        <h1>WhatsApp Messaging</h1>
        <p>
          Messages are sent from your business channel ({connectInfo?.channelName || "Innovate Electronics"}).
          The recipient field is the customer&apos;s WhatsApp number.
        </p>
      </div>

      {error && (
        <div className="alert alert-error">
          <span className="alert-icon">⚠️</span>
          {error}
          <button type="button" className="alert-close" onClick={() => setError(null)}>×</button>
        </div>
      )}

      {success && (
        <div className="alert alert-success">
          <span className="alert-icon">✓</span>
          {success}
          <button type="button" className="alert-close" onClick={() => setSuccess(null)}>×</button>
        </div>
      )}

      <div className="card connection-card">
        <h2>Connection Status</h2>

        <div className={connectionStatus?.connected ? "connection-connected" : "connection-disconnected"}>
          <div className="status-badge">
            <span className="status-dot"></span>
            {connectionStatus?.connected ? "Connected" : "Not Connected"}
          </div>

          <div className="connection-info">
            <p><strong>Channel Name:</strong> {connectInfo?.channelName || "Innovate Electronics"}</p>
            <p><strong>Channel Number:</strong> {connectInfo?.businessNumber || "+917676348836"}</p>
            <p><strong>Channel ID:</strong> {connectInfo?.phoneNumberId || "—"}</p>
            <p><strong>Token Present:</strong> {connectInfo?.tokenPresent ? "Yes" : "No"}</p>
            {connectInfo?.whatsapp?.verifiedName && (
              <p><strong>Verified Name:</strong> {connectInfo.whatsapp.verifiedName}</p>
            )}
          </div>

          {connectInfo?.info && (
            <div className="help-box">
              <strong>Setup</strong>
              <div>{connectInfo.info}</div>
            </div>
          )}
          <div className="help-box wa-meta-note">
            <strong>Connect the same business line (+91 7676348836)</strong>
            <p className="wa-meta-note-text">
              The WhatsApp &quot;channel&quot; on your phone uses that number. DMAT talks to Meta&apos;s{' '}
              <strong>WhatsApp Cloud API</strong>: add <code>WHATSAPP_PHONE_NUMBER_ID</code> and{' '}
              <code>WHATSAPP_TOKEN</code> from{' '}
              <a href="https://developers.facebook.com/apps/" target="_blank" rel="noopener noreferrer">
                developers.facebook.com
              </a>{' '}
              (App → WhatsApp → API Setup). Set <code>WHATSAPP_BUSINESS_NUMBER=+917676348836</code> in{' '}
              <code>backend/.env</code> so the UI shows the correct line.
            </p>
          </div>
        </div>
      </div>

      <div className="card composer-card">
        <h2>Send message</h2>
        <p className="form-hint" style={{ marginTop: 0 }}>
          Meta sends this from your WhatsApp Business number. The customer often must have messaged you first or you must use an approved template outside the 24-hour window.
        </p>

        <div className="form-group">
          <label>To (recipient WhatsApp number) *</label>
          <input
            type="text"
            className="form-control"
            value={toNumber}
            onChange={(e) => setToNumber(e.target.value)}
            placeholder="e.g. +919876543210"
            autoComplete="tel"
          />
        </div>
        <div className="form-group">
          <label>Message *</label>
          <textarea
            className="form-control"
            rows={5}
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            placeholder="Type your message…"
          />
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleSend}
          disabled={loading || !messageText.trim() || !toNumber.trim()}
        >
          {loading ? "Sending…" : "Send WhatsApp message"}
        </button>
      </div>

      <div className="card history-card">
        <h2>Message History</h2>
        {messages.length === 0 ? (
          <div className="empty-state">
            <p>No messages yet.</p>
          </div>
        ) : (
          <div className="posts-list">
            {messages.map((m) => (
              <div key={m.id} className="post-item">
                <div className="post-header">
                  <span className="post-date">{m.created_at ? new Date(m.created_at).toLocaleString() : "—"}</span>
                  <span style={{ fontWeight: 600 }}>
                    {m.status === "failed" ? "Failed" : "Sent"}
                  </span>
                </div>
                <div className="post-content">
                  <div><strong>To:</strong> {m.to_number ? `+${m.to_number}` : "—"}</div>
                  <div style={{ marginTop: 6 }}>{m.message_text}</div>
                  {m.message_id && (
                    <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
                      Message ID: {m.message_id}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
