import React, { useState } from 'react';
import { supabase, supabaseConfigurationError } from './supabaseClient.js';
import { ArrowIcon, AuthActions, BrandMark } from './AuthNavigation.jsx';

function getAuthError(error, mode) {
  const code = error?.code || '';
  const message = error?.message || '';
  if (code === 'invalid_credentials' || /invalid login credentials/i.test(message)) {
    return 'That email and password combination was not recognized. Check them and try again.';
  }
  if (code === 'email_not_confirmed' || /email not confirmed/i.test(message)) {
    return 'Please confirm your email using the link we sent before logging in.';
  }
  if (mode === 'register' && /already registered|already exists/i.test(message)) {
    return 'An account with this email may already exist. Try logging in instead.';
  }
  if (/failed to fetch|network/i.test(message)) {
    return 'Could not reach AutoRent right now. Check your internet connection and try again.';
  }
  return message || 'Something went wrong. Please try again.';
}

export default function AuthPage({ mode, onNavigate, onAuthSuccess, user, profile, authLoading, onLogout, actionError }) {
  const isRegister = mode === 'register';
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', password: '', confirmPassword: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [confirmationEmail, setConfirmationEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setFieldErrors((current) => ({ ...current, [name]: '' }));
    setFormError('');
  }

  function validate() {
    const errors = {};
    const email = form.email.trim();
    if (isRegister && form.fullName.trim().length < 2) errors.fullName = 'Enter your full name.';
    if (!email) errors.email = 'Enter your email address.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Enter a valid email address.';
    if (isRegister && form.phone.trim()) {
      const digits = form.phone.replace(/\D/g, '');
      if (digits.length < 7 || digits.length > 15) errors.phone = 'Enter a phone number with 7 to 15 digits, or leave it blank.';
    }
    if (!form.password) errors.password = 'Enter your password.';
    else if (isRegister && form.password.length < 8) errors.password = 'Use at least 8 characters for your password.';
    if (isRegister && form.confirmPassword !== form.password) errors.confirmPassword = 'The passwords do not match.';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError('');
    setConfirmationEmail('');
    if (!validate()) return;
    if (!supabase) {
      setFormError(supabaseConfigurationError || 'Supabase is not configured.');
      return;
    }

    setSubmitting(true);
    try {
      if (isRegister) {
        const { error } = await supabase.auth.signUp({
          email: form.email.trim(),
          password: form.password,
          options: {
            data: {
              full_name: form.fullName.trim(),
              phone: form.phone.trim(),
            },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        // The existing auth.users trigger creates public.users. Do not insert a profile here.
        setConfirmationEmail(form.email.trim());
        setForm({ fullName: '', email: '', phone: '', password: '', confirmPassword: '' });
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: form.email.trim(),
          password: form.password,
        });
        if (error) throw error;
        onAuthSuccess();
      }
    } catch (error) {
      setFormError(getAuthError(error, mode));
    } finally {
      setSubmitting(false);
    }
  }

  function handleFormChange(field) {
    return {
      id: `auth-${field}`,
      name: field,
      value: form[field],
      onChange: updateField,
      'aria-invalid': Boolean(fieldErrors[field]),
      'aria-describedby': fieldErrors[field] ? `auth-${field}-error` : undefined,
    };
  }

  return (
    <div className="site-shell auth-page">
      <header className="site-header">
        <a className="brand" href="/" onClick={(event) => { event.preventDefault(); onNavigate('/'); }} aria-label="AutoRent home">
          <BrandMark /><span>auto<span className="brand-accent">rent</span></span>
        </a>
        <nav className="main-nav auth-main-nav" aria-label="Main navigation">
          <a className="nav-link" href="/" onClick={(event) => { event.preventDefault(); onNavigate('/'); }}>Home</a>
          <a className="nav-link" href="/vehicles" onClick={(event) => { event.preventDefault(); onNavigate('/vehicles'); }}>Browse Vehicles</a>
          <a className="nav-link" href="/#bookings" onClick={(event) => { event.preventDefault(); onNavigate('/#bookings'); }}>My Bookings</a>
        </nav>
        <AuthActions user={user} profile={profile} loading={authLoading} onLogout={onLogout} onNavigate={onNavigate} />
      </header>

      <main className="auth-main" aria-labelledby="auth-title">
        <section className="auth-card">
          <p className="eyebrow">YOUR NEXT RIDE STARTS HERE</p>
          <h1 id="auth-title">{isRegister ? 'Create your account.' : 'Welcome back.'}</h1>
          <p className="auth-intro">{isRegister ? 'Join AutoRent and get ready for the road ahead.' : 'Log in to continue with AutoRent.'}</p>

          {actionError && <p className="auth-message auth-error" role="alert">{actionError}</p>}
          {confirmationEmail ? (
            <div className="auth-message auth-success" role="status" aria-live="polite">
              <strong>Check your email to confirm your account.</strong>
              <span>We sent a confirmation link to {confirmationEmail}. Open it to finish registration, then come back and log in.</span>
              <a className="button button-primary auth-confirm-login" href="/login" onClick={(event) => { event.preventDefault(); onNavigate('/login'); }}>Go to login <ArrowIcon /></a>
            </div>
          ) : (
            <form className="auth-form" onSubmit={handleSubmit} noValidate>
              {formError && <p className="auth-message auth-error" role="alert">{formError}</p>}

              {isRegister && (
                <div className="auth-field">
                  <label htmlFor="auth-fullName">Full name</label>
                  <input {...handleFormChange('fullName')} type="text" autoComplete="name" required aria-required="true" />
                  {fieldErrors.fullName && <span className="auth-field-error" id="auth-fullName-error">{fieldErrors.fullName}</span>}
                </div>
              )}

              <div className="auth-field">
                <label htmlFor="auth-email">Email address</label>
                <input {...handleFormChange('email')} type="email" autoComplete="email" required aria-required="true" />
                {fieldErrors.email && <span className="auth-field-error" id="auth-email-error">{fieldErrors.email}</span>}
              </div>

              {isRegister && (
                <div className="auth-field">
                  <label htmlFor="auth-phone">Phone <span>(optional)</span></label>
                  <input {...handleFormChange('phone')} type="tel" autoComplete="tel" inputMode="tel" />
                  {fieldErrors.phone && <span className="auth-field-error" id="auth-phone-error">{fieldErrors.phone}</span>}
                </div>
              )}

              <div className="auth-field">
                <label htmlFor="auth-password">Password</label>
                <input {...handleFormChange('password')} type="password" autoComplete={isRegister ? 'new-password' : 'current-password'} required aria-required="true" />
                {isRegister && <span className="auth-field-hint">Use at least 8 characters.</span>}
                {fieldErrors.password && <span className="auth-field-error" id="auth-password-error">{fieldErrors.password}</span>}
              </div>

              {isRegister && (
                <div className="auth-field">
                  <label htmlFor="auth-confirmPassword">Confirm password</label>
                  <input {...handleFormChange('confirmPassword')} type="password" autoComplete="new-password" required aria-required="true" />
                  {fieldErrors.confirmPassword && <span className="auth-field-error" id="auth-confirmPassword-error">{fieldErrors.confirmPassword}</span>}
                </div>
              )}

              <button className="button button-primary auth-submit" type="submit" disabled={submitting}>
                {submitting ? 'Please wait…' : isRegister ? 'Create account' : 'Log in'} <ArrowIcon />
              </button>
            </form>
          )}

          {!confirmationEmail && (
            <p className="auth-switch">
              {isRegister ? 'Already have an account?' : 'New to AutoRent?'}{' '}
              <a href={isRegister ? '/login' : '/register'} onClick={(event) => { event.preventDefault(); onNavigate(isRegister ? '/login' : '/register'); }}>
                {isRegister ? 'Log in' : 'Create an account'}
              </a>
            </p>
          )}
        </section>
      </main>

      <footer className="browse-footer auth-footer">
        <a className="brand brand-footer" href="/" onClick={(event) => { event.preventDefault(); onNavigate('/'); }}><BrandMark /><span>auto<span className="brand-accent">rent</span></span></a>
        <span>Good rides. Great stories.</span>
        <a href="/vehicles" onClick={(event) => { event.preventDefault(); onNavigate('/vehicles'); }} className="browse-back-top">Browse vehicles <ArrowIcon /></a>
      </footer>
    </div>
  );
}
