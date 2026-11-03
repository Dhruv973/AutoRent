import React from 'react';

export function ArrowIcon({ diagonal = false }) {
  return diagonal ? (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none"><path d="M5 15 15 5M6 5h9v9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
  ) : (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none"><path d="M3.5 10h12m-5-5 5 5-5 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
  );
}

export function BrandMark() {
  return <span className="brand-mark" aria-hidden="true"><svg viewBox="0 0 32 32" fill="none"><path d="M5 19.5 7.5 12a3 3 0 0 1 2.8-2h11.4a3 3 0 0 1 2.8 2l2.5 7.5v6h-3v-3H8v3H5v-6Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /><path d="M8 18h16M10 22h.1m11.8 0h.1" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" /></svg></span>;
}

export function AuthActions({ user, profile, loading, onLogout, onNavigate }) {
  if (loading) return <span className="auth-session-loading" role="status">Checking account…</span>;

  if (user) {
    const displayName = profile?.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Account';
    return (
      <div className="auth-actions account-actions">
        <span className="account-name" title={displayName}>{displayName}</span>
        <button className="login-button" type="button" onClick={onLogout}>Logout</button>
      </div>
    );
  }

  return (
    <div className="auth-actions">
      <a className="auth-login-link" href="/login" onClick={(event) => { event.preventDefault(); onNavigate('/login'); }}>Login</a>
      <a className="login-button auth-register-link" href="/register" onClick={(event) => { event.preventDefault(); onNavigate('/register'); }}>Register</a>
    </div>
  );
}
