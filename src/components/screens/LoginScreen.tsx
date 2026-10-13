import React, { useRef, useState } from 'react';
import { Eye, EyeOff, Sparkles } from 'lucide-react';
import { ClosiqLogo } from '../ui/ClosiqLogo';
import { PrimaryButton } from '../ui/PrimaryButton';
import { signIn, signInDemo, signUp, sendPasswordReset, AuthOutcome } from '../../services/cloud/auth';

type Mode = 'signin' | 'signup' | 'reset';

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '13px 14px',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--color-border-medium)',
  backgroundColor: 'var(--color-surface-elevated)',
  color: 'var(--color-text-primary)',
  fontSize: '0.92rem',
  outline: 'none'
};

const linkStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--color-primary)',
  fontWeight: 600,
  fontSize: '0.84rem',
  cursor: 'pointer',
  padding: 0
};

/**
 * Web sign-in. Same accounts as the mobile app, so a wardrobe built on the
 * phone shows up here (and the other way round). App.tsx swaps this screen
 * out as soon as Supabase reports a session.
 */
export const LoginScreen: React.FC = () => {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  // Guards double-clicks synchronously; `busy` state lags by one render.
  const inFlight = useRef(false);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setInfo(null);
    setConfirm('');
  };

  const run = async (action: () => Promise<AuthOutcome>) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const result = await action();
      if (!result.ok) setError(result.message || 'Something went wrong.');
      else if (result.message) setInfo(result.message);
    } catch {
      setError('Couldn’t reach CLOSIQ. Check your connection and try again.');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return setError('Please enter your email.');
    if (mode === 'reset') return run(() => sendPasswordReset(email));
    if (!password) return setError('Please enter your password.');
    if (mode === 'signup') {
      if (password.length < 6) return setError('Use a password with at least 6 characters.');
      if (password !== confirm) return setError('Passwords don’t match.');
      return run(() => signUp(email, password));
    }
    return run(() => signIn(email, password));
  };

  const title = mode === 'signin' ? 'Welcome back' : mode === 'signup' ? 'Create your wardrobe' : 'Reset your password';
  const subtitle =
    mode === 'signin'
      ? 'Sign in to see your clothes and get outfit ideas.'
      : mode === 'signup'
      ? 'Same account works on the CLOSIQ phone app.'
      : 'We’ll email you a link to choose a new password.';

  return (
    <div className="login-layout">
      <div className="login-hero" aria-hidden="true">
        <ClosiqLogo width={200} />
        <p className="text-display login-hero__tagline">Style what you already own.</p>
        <p className="text-body login-hero__copy">
          Photograph your clothes, keep track of where everything is kept, and let the AI stylist build outfits from your
          real wardrobe.
        </p>
      </div>

      <form className="login-card" onSubmit={handleSubmit} noValidate>
        <div className="login-card__logo">
          <ClosiqLogo width={150} />
        </div>
        <h1 className="text-screen-heading" style={{ marginBottom: 4 }}>{title}</h1>
        <p className="text-body" style={{ marginBottom: 22 }}>{subtitle}</p>

        <label className="text-metadata" htmlFor="login-email" style={{ display: 'block', marginBottom: 6 }}>Email</label>
        <input
          id="login-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ ...inputStyle, marginBottom: 14 }}
          placeholder="you@example.com"
        />

        {mode !== 'reset' && (
          <>
            <label className="text-metadata" htmlFor="login-password" style={{ display: 'block', marginBottom: 6 }}>Password</label>
            <div style={{ position: 'relative', marginBottom: 14 }}>
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ ...inputStyle, paddingRight: 44 }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </>
        )}

        {mode === 'signup' && (
          <>
            <label className="text-metadata" htmlFor="login-confirm" style={{ display: 'block', marginBottom: 6 }}>Confirm password</label>
            <input
              id="login-confirm"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              style={{ ...inputStyle, marginBottom: 14 }}
            />
          </>
        )}

        {error && (
          <p role="alert" style={{ color: 'var(--color-danger)', fontSize: '0.84rem', marginBottom: 12 }}>{error}</p>
        )}
        {info && (
          <p role="status" style={{ color: 'var(--color-success)', fontSize: '0.84rem', marginBottom: 12 }}>{info}</p>
        )}

        <PrimaryButton fullWidth type="submit" disabled={busy}>
          {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Send reset link'}
        </PrimaryButton>

        {mode === 'signin' && (
          <button
            type="button"
            disabled={busy}
            onClick={() => run(signInDemo)}
            className="login-demo"
          >
            <Sparkles size={15} /> Try the demo wardrobe
          </button>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 18, flexWrap: 'wrap' }}>
          {mode === 'signin' ? (
            <>
              <button type="button" style={linkStyle} onClick={() => switchMode('signup')}>New here? Create an account</button>
              <button type="button" style={linkStyle} onClick={() => switchMode('reset')}>Forgot password?</button>
            </>
          ) : (
            <button type="button" style={linkStyle} onClick={() => switchMode('signin')}>Back to sign in</button>
          )}
        </div>
      </form>
    </div>
  );
};
