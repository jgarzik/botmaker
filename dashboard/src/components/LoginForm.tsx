import { useState, FormEvent } from 'react';
import './LoginForm.css';

interface LoginFormProps {
  onLogin: (password: string) => Promise<void>;
  error: string | null;
  isLoading: boolean;
}

export default function LoginForm({ onLogin, error, isLoading }: LoginFormProps) {
  const [password, setPassword] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;
    onLogin(password).catch(() => {
      // Error is handled by parent
    });
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">
            <svg width="48" height="48" viewBox="0 0 32 32" fill="none">
              <rect x="2" y="2" width="28" height="28" rx="4" stroke="currentColor" strokeWidth="2" />
              <circle cx="10" cy="12" r="3" fill="currentColor" className="login-logo-eye" />
              <circle cx="22" cy="12" r="3" fill="currentColor" className="login-logo-eye" />
              <path d="M8 20h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <path d="M10 24h4M18 24h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <h1 className="login-title">BotMaker</h1>
          <p className="login-subtitle">Enter your password to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="login-field">
            <label htmlFor="password" className="login-label">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); }}
              className="login-input"
              placeholder="Enter admin password"
              autoFocus
              disabled={isLoading}
            />
          </div>

          {error && (
            <div className="login-error">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="8" cy="8" r="7" />
                <path d="M8 4v4M8 10v2" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            className="login-button"
            disabled={isLoading || !password.trim()}
          >
            {isLoading ? (
              <>
                <span className="login-spinner" />
                <span>Signing in...</span>
              </>
            ) : (
              <span>Sign In</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
