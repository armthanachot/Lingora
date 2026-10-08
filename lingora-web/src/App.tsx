import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from './api/client';
import { GoogleSignInButton } from './features/auth/GoogleSignInButton';
import { ProfileCompletionModal } from './features/auth/ProfileCompletionModal';
import { authApi } from './features/auth/google';
import { LearningPage } from './features/learning/LearningPage';
import { GlobeExplorer } from './features/globe/GlobeExplorer';
import { LandingPage } from './features/landing/LandingPage';
import { SettingsPage } from './features/settings/SettingsPage';
import { ThemeToggle } from './features/theme/ThemeToggle';
import { useThemePreference } from './features/theme/theme';
import type { User } from './features/users';
import { SelectionReader } from './features/speech/SelectionReader';
import './style.css';

type AppView = 'landing' | 'app' | 'settings' | 'learning';

function viewFromHash(): AppView {
  if (/^#courses(?:\/|$)/.test(window.location.hash)) return 'learning';
  if (window.location.hash === '#settings') return 'settings';
  if (window.location.hash === '#app') return 'app';
  return 'landing';
}

function DoorExitIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M10.5 4.5H6.8A1.8 1.8 0 0 0 5 6.3v11.4a1.8 1.8 0 0 0 1.8 1.8h3.7" />
      <path d="M13.5 8.2 17.3 12l-3.8 3.8M9 12h8" />
      <path d="M10.5 3.5v17" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 8.7a3.3 3.3 0 1 0 0 6.6 3.3 3.3 0 0 0 0-6.6Z" />
      <path d="m19.4 13.5 1.4 1.1-1.7 3-1.8-.7c-.5.4-1 .7-1.6.9l-.3 1.9H12l-.3-1.9c-.6-.2-1.1-.5-1.6-.9l-1.8.7-1.7-3 1.4-1.1a6 6 0 0 1 0-1.9l-1.4-1.1 1.7-3 1.8.7c.5-.4 1-.7 1.6-.9L12 5.4h3.4l.3 1.9c.6.2 1.1.5 1.6.9l1.8-.7 1.7 3-1.4 1.1a6 6 0 0 1 0 1.9Z" />
    </svg>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authError, setAuthError] = useState('');
  const [authOpen, setAuthOpen] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [view, setView] = useState<AppView>(() => viewFromHash());
  const [learningRoute, setLearningRoute] = useState(() => window.location.hash);
  const pendingLearningRoute = useRef(/^#courses(?:\/|$)/.test(window.location.hash) ? window.location.hash : '');
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const { preference: theme, resolvedTheme, setPreference: setTheme } = useThemePreference();

  useEffect(() => {
    let cancelled = false;
    void authApi.me()
      .then(({ user: currentUser }) => {
        if (!cancelled) setUser(currentUser);
      })
      .catch((error: unknown) => {
        if (!cancelled && (!(error instanceof ApiError) || error.status !== 401)) {
          setAuthError(error instanceof Error ? error.message : String(error));
        }
      })
      .finally(() => {
        if (!cancelled) setAuthReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const syncView = () => { setView(viewFromHash()); setLearningRoute(window.location.hash); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', syncView);
    return () => window.removeEventListener('hashchange', syncView);
  }, []);

  useEffect(() => {
    if (!profileOpen) return;

    function closeFromOutside(event: PointerEvent) {
      if (!profileMenuRef.current?.contains(event.target as Node)) {
        setProfileOpen(false);
      }
    }

    function closeFromEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setProfileOpen(false);
      }
    }

    document.addEventListener('pointerdown', closeFromOutside);
    document.addEventListener('keydown', closeFromEscape);
    return () => {
      document.removeEventListener('pointerdown', closeFromOutside);
      document.removeEventListener('keydown', closeFromEscape);
    };
  }, [profileOpen]);

  useEffect(() => {
    setProfileOpen(false);
  }, [view]);

  useEffect(() => {
    if (!authReady) return;

    if (view === 'settings' && (!user || !user.isSuperAdmin)) {
      window.location.hash = user ? 'app' : '';
      setView(user ? 'app' : 'landing');
      return;
    }

    if ((view === 'app' || view === 'learning') && !user) {
      if (view === 'learning') { pendingLearningRoute.current = window.location.hash; setAuthOpen(true); }
      window.location.hash = '';
      setView('landing');
    }
  }, [authReady, user, view]);

  const openApp = useCallback(() => {
    window.location.hash = 'app';
    setView('app');
  }, []);

  const handleSignedIn = useCallback((signedInUser: User) => {
    setUser(signedInUser);
    setAuthError('');
    setAuthOpen(false);
    const destination = pendingLearningRoute.current || '#app';
    pendingLearningRoute.current = '';
    window.location.hash = destination;
    setLearningRoute(destination);
    setView(viewFromHash());
  }, []);

  const handleAuthError = useCallback((message: string) => {
    setAuthError(message);
  }, []);

  async function signOut() {
    setProfileOpen(false);
    pendingLearningRoute.current = '';
    try {
      await authApi.signOut();
    } finally {
      window.google?.accounts.id.disableAutoSelect();
      setUser(null);
      setAuthError('');
      setAuthOpen(false);
      window.location.hash = '';
      setView('landing');
    }
  }

  function startFromLanding() {
    if (!authReady) return;
    if (user) {
      openApp();
      return;
    }
    setAuthError('');
    setAuthOpen(true);
  }

  function openSettings() {
    if (!user?.isSuperAdmin) return;
    setProfileOpen(false);
    window.location.hash = 'settings';
    setView('settings');
  }

  function backToGlobe() {
    window.location.hash = 'app';
    setView('app');
  }

  function backToLanding() {
    window.location.hash = '';
    setView('landing');
  }

  const accountSlot = user ? (
    <div className="app-account-tools">
      <ThemeToggle value={theme} onChange={setTheme} compact />

      <div className="profile-menu" ref={profileMenuRef}>
        <button
          className="profile-trigger"
          type="button"
          aria-haspopup="menu"
          aria-expanded={profileOpen}
          onClick={() => setProfileOpen((open) => !open)}
        >
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt="" referrerPolicy="no-referrer" />
          ) : (
            <span className="profile-avatar-fallback" aria-hidden="true">
              {(user.displayName || user.firstName || user.email).slice(0, 1).toUpperCase()}
            </span>
          )}
          <span className="profile-trigger-name">{user.displayName || user.firstName || user.email}</span>
          <svg className="profile-trigger-chevron" viewBox="0 0 16 16" aria-hidden="true">
            <path d="m4 6 4 4 4-4" />
          </svg>
        </button>

        {profileOpen && (
          <div className="profile-popover" role="menu">
            <div className="profile-popover-identity">
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt="" referrerPolicy="no-referrer" />
              ) : (
                <span className="profile-popover-fallback" aria-hidden="true">
                  {(user.displayName || user.firstName || user.email).slice(0, 1).toUpperCase()}
                </span>
              )}
              <div>
                <strong>{user.displayName || user.firstName || 'Lingora learner'}</strong>
                <span>{user.email}</span>
              </div>
            </div>

            <div className="profile-popover-divider" />

            {user.isSuperAdmin && (
              <>
                <button className="profile-popover-action" type="button" role="menuitem" onClick={openSettings}>
                  <span className="profile-popover-action-icon"><SettingsIcon /></span>
                  <span>
                    <strong>Settings</strong>
                    <small>Manage users and master data</small>
                  </span>
                  <span className="profile-popover-arrow" aria-hidden="true">→</span>
                </button>
                <div className="profile-popover-divider is-action-divider" />
              </>
            )}

            <button
              className="profile-popover-action is-danger"
              type="button"
              role="menuitem"
              onClick={() => void signOut()}
            >
              <span className="profile-popover-action-icon"><DoorExitIcon /></span>
              <span>
                <strong>Sign out</strong>
                <small>End this Lingora session</small>
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  ) : null;

  const needsDisplayName = Boolean(user && !user.displayName?.trim());

  return (
    <>
      {!authReady && view !== 'landing' ? (
        <div className="learning-content" role="status">Checking your account…</div>
      ) : view === 'settings' && user?.isSuperAdmin ? (
        <SettingsPage
          currentUser={user}
          onCurrentUserChange={setUser}
          onBack={backToGlobe}
          themeControl={<ThemeToggle value={theme} onChange={setTheme} compact />}
        />
      ) : view === 'learning' && user ? (
        <LearningPage key={learningRoute} accountSlot={accountSlot} isAdmin={user.isSuperAdmin} />
      ) : view === 'app' && user ? (
        <GlobeExplorer
          accountSlot={accountSlot}
          appearance={resolvedTheme}
          onBackToLanding={backToLanding}
        />
      ) : (
        <LandingPage
          user={user}
          authReady={authReady}
          theme={theme}
          resolvedTheme={resolvedTheme}
          onThemeChange={setTheme}
          onStart={startFromLanding}
        />
      )}

      {authOpen && !user && (
        <div className="landing-auth-backdrop" role="presentation" onMouseDown={() => setAuthOpen(false)}>
          <section
            className="landing-auth-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="landing-auth-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button className="landing-auth-close" type="button" aria-label="Close sign in" onClick={() => setAuthOpen(false)}>×</button>
            <span className="landing-auth-spark" aria-hidden="true">✦</span>
            <span className="auth-eyebrow">Welcome to Lingora</span>
            <h2 id="landing-auth-title">Start your brighter journey</h2>
            <p>Sign in with Google to explore the globe, choose a language, and keep your learning progress together.</p>
            <GoogleSignInButton onSignedIn={handleSignedIn} onError={handleAuthError} appearance={resolvedTheme} />
            {authError && <p className="auth-error" role="alert">{authError}</p>}
          </section>
        </div>
      )}

      {user && needsDisplayName && <ProfileCompletionModal user={user} onCompleted={setUser} />}
      {user && <SelectionReader key={user.id} />}
    </>
  );
}
