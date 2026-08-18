import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator
} from 'react-native';
import { Eye, EyeOff, AlertCircle, CheckCircle2, Sparkles } from 'lucide-react-native';
import { COLORS, RADIUS } from '../theme';
import { signIn, signUp, signInDemo, DEMO_DISPLAY_EMAIL, DEMO_DISPLAY_PASSWORD } from '../services/authService';
import { isSupabaseConfigured } from '../services/supabaseClient';

type Mode = 'login' | 'signup';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * App.tsx doesn't need a callback prop here — a successful signIn/signUp/
 * signInDemo() triggers Supabase's own onAuthStateChange, which App.tsx is
 * already listening to (see authService.ts/App.tsx) and reacts to by
 * unmounting this screen on its own. This screen only ever talks to
 * authService.ts, never touches session state directly.
 */
export const LoginScreen: React.FC = () => {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const resetMessages = () => {
    setErrorMessage(null);
    setInfoMessage(null);
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    resetMessages();
    setConfirmPassword('');
    setShowPassword(false);
  };

  const handleSubmit = async () => {
    if (loading) return;
    resetMessages();

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setErrorMessage('Enter your email and password.');
      return;
    }

    if (mode === 'signup') {
      // Real validation matters here (no demo shortcut applies to signup) —
      // fast, specific feedback before ever hitting the network.
      if (!EMAIL_RE.test(trimmedEmail)) {
        setErrorMessage('Enter a valid email address.');
        return;
      }
      if (password.length < 6) {
        setErrorMessage('Password must be at least 6 characters.');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMessage('Passwords do not match.');
        return;
      }
    }

    setLoading(true);
    const result = mode === 'login' ? await signIn(trimmedEmail, password) : await signUp(trimmedEmail, password);
    setLoading(false);

    if (!result.ok) {
      setErrorMessage(result.message || 'Something went wrong. Please try again.');
      return;
    }
    if (!result.session) {
      // Account created, but this Supabase project requires email
      // confirmation before a session is issued — nothing more to do here,
      // App.tsx's auth listener will pick up the real session once the
      // user confirms and logs in.
      setInfoMessage(result.message || 'Check your email to confirm your account.');
      return;
    }
    // result.session exists — App.tsx's onAuthStateChange listener takes it
    // from here (unmounts this screen, moves to the onboarding/main gate).
  };

  const handleDemoLogin = async () => {
    if (loading) return;
    resetMessages();
    setLoading(true);
    const result = await signInDemo();
    setLoading(false);
    if (!result.ok) {
      setErrorMessage(result.message || 'Unable to sign into the demo account.');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.brandBlock}>
          <Image source={require('../../assets/closiq-logo.png')} style={styles.logo} resizeMode="contain" />
          <Text style={styles.tagline}>AI Personal Wardrobe & Stylist</Text>
        </View>

        <Text style={styles.heading}>{mode === 'login' ? 'Welcome back' : 'Create your account'}</Text>
        <Text style={styles.subheading}>
          {mode === 'login'
            ? 'Log in to your closet.'
            : 'Just an email and password — the rest is a quick setup after this.'}
        </Text>

        {!isSupabaseConfigured && (
          <View style={[styles.messageBox, styles.errorBox]}>
            <AlertCircle size={16} color={COLORS.danger} style={{ marginRight: 8 }} />
            <Text style={styles.messageText}>
              CLOSIQ's account service isn't configured yet on this build — login will not connect until it is.
            </Text>
          </View>
        )}

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          placeholderTextColor={COLORS.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
        />

        <Text style={styles.label}>Password</Text>
        <View style={styles.passwordRow}>
          <TextInput
            style={styles.passwordInput}
            value={password}
            onChangeText={setPassword}
            placeholder={mode === 'signup' ? 'At least 6 characters' : 'Password'}
            placeholderTextColor={COLORS.textMuted}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            textContentType={mode === 'signup' ? 'newPassword' : 'password'}
          />
          <TouchableOpacity
            style={styles.eyeBtn}
            onPress={() => setShowPassword((v) => !v)}
            accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? (
              <EyeOff size={18} color={COLORS.textMuted} />
            ) : (
              <Eye size={18} color={COLORS.textMuted} />
            )}
          </TouchableOpacity>
        </View>

        {mode === 'signup' && (
          <>
            <Text style={styles.label}>Confirm Password</Text>
            <TextInput
              style={styles.input}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Re-enter your password"
              placeholderTextColor={COLORS.textMuted}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              textContentType="newPassword"
            />
          </>
        )}

        {errorMessage && (
          <View style={[styles.messageBox, styles.errorBox]}>
            <AlertCircle size={16} color={COLORS.danger} style={{ marginRight: 8 }} />
            <Text style={styles.messageText}>{errorMessage}</Text>
          </View>
        )}
        {infoMessage && (
          <View style={[styles.messageBox, styles.infoBox]}>
            <CheckCircle2 size={16} color={COLORS.primary} style={{ marginRight: 8 }} />
            <Text style={styles.messageText}>{infoMessage}</Text>
          </View>
        )}

        <TouchableOpacity
          style={styles.primaryBtn}
          activeOpacity={0.85}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.primaryBtnText}>{mode === 'login' ? 'Log In' : 'Create Account'}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.switchModeBtn}
          onPress={() => switchMode(mode === 'login' ? 'signup' : 'login')}
          disabled={loading}
        >
          <Text style={styles.switchModeText}>
            {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <Text style={styles.switchModeLink}>{mode === 'login' ? 'Sign Up' : 'Log In'}</Text>
          </Text>
        </TouchableOpacity>

        {mode === 'login' && (
          <View style={styles.demoSection}>
            <View style={styles.divider} />
            <TouchableOpacity
              style={styles.demoBtn}
              activeOpacity={0.8}
              onPress={handleDemoLogin}
              disabled={loading}
            >
              <Sparkles size={14} color={COLORS.primary} style={{ marginRight: 6 }} />
              <Text style={styles.demoBtnText}>Try Demo Account</Text>
            </TouchableOpacity>
            <Text style={styles.demoHint}>
              {DEMO_DISPLAY_EMAIL} / {DEMO_DISPLAY_PASSWORD} — preloaded with a sample wardrobe
            </Text>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: COLORS.bg
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 32
  },
  brandBlock: {
    alignItems: 'center',
    marginBottom: 28
  },
  logo: {
    width: 160,
    height: 46,
    marginBottom: 8
  },
  tagline: {
    fontSize: 11.5,
    fontWeight: '600',
    color: COLORS.primary,
    letterSpacing: 1,
    textTransform: 'uppercase'
  },
  heading: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 4
  },
  subheading: {
    fontSize: 13.5,
    color: COLORS.textSecondary,
    marginBottom: 20,
    lineHeight: 19
  },
  label: {
    fontSize: 12.5,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 8,
    marginTop: 14
  },
  input: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: 14,
    fontSize: 14,
    color: COLORS.textPrimary,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  passwordInput: {
    flex: 1,
    padding: 14,
    fontSize: 14,
    color: COLORS.textPrimary
  },
  eyeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 14
  },
  messageBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: RADIUS.md,
    borderLeftWidth: 3,
    marginTop: 16
  },
  errorBox: {
    backgroundColor: COLORS.surfaceSubtle,
    borderLeftColor: COLORS.danger
  },
  infoBox: {
    backgroundColor: COLORS.surfaceSubtle,
    borderLeftColor: COLORS.primary
  },
  messageText: {
    flex: 1,
    fontSize: 12.5,
    color: COLORS.textPrimary,
    lineHeight: 17
  },
  primaryBtn: {
    marginTop: 22,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.pill,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center'
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '700'
  },
  switchModeBtn: {
    marginTop: 16,
    alignItems: 'center'
  },
  switchModeText: {
    fontSize: 13,
    color: COLORS.textSecondary
  },
  switchModeLink: {
    color: COLORS.primary,
    fontWeight: '700'
  },
  demoSection: {
    marginTop: 28,
    alignItems: 'center'
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    alignSelf: 'stretch',
    marginBottom: 20
  },
  demoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.primaryAlpha
  },
  demoBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: COLORS.primary
  },
  demoHint: {
    fontSize: 10.5,
    color: COLORS.textMuted,
    marginTop: 8,
    textAlign: 'center'
  }
});
