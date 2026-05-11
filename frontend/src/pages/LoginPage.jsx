import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
// theme removed
import { useAuth } from '../context/AuthContext';
// theme removed
import './LoginPage.css';

function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  // theme removed

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await login(email, password);

    if (result.success) {
      navigate('/landing-pages');
    } else {
      setError(result.error || 'Login failed. Please check your credentials.');
    }

    setLoading(false);
  };

  return (
    <div className="login-page">
      {/* theme toggle removed */}
      <div className="login-container">
        <div className="login-card">
          <div className="login-header brand">
            <img src="/innovate-logo.png" alt="Innovate Electronics" className="brand-logo" />
            <div style={{ marginLeft: 12 }}>
              <h1>Innovate Electronics</h1>
              <p>Digital Marketing Automation Tool</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="login-form">
            <h2>Sign In</h2>

            {error && (
              <div className="error-message">
                {error}
              </div>
            )}

            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                autoFocus
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                disabled={loading}
              />
            </div>

            <button type="submit" className="login-button" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>

            <div className="login-footer">
              <p className="demo-credentials">
                <strong>Demo Credentials:</strong><br />
                Email: admin@innovateelectronics.com<br />
                Password: password123
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
