import { useEffect, useState } from 'react';
import type { User } from '../users';
import { BrandMark } from '../../components/BrandMark';
import { ThemeToggle } from '../theme/ThemeToggle';
import type { ResolvedTheme, ThemePreference } from '../theme/theme';

type LandingPageProps = {
  user: User | null;
  authReady: boolean;
  theme: ThemePreference;
  resolvedTheme: ResolvedTheme;
  onThemeChange: (theme: ThemePreference) => void;
  onStart: () => void;
};

type NavTarget = 'landing-top' | 'landing-languages' | 'landing-courses' | 'landing-about';
type GlobeAssetStage = 'theme' | 'alt' | 'fallback';

const LANDING_GLOBE_ASSETS = {
  light: '/assets/illustrations/landing/landing-globe-light.png',
  dark: '/assets/illustrations/landing/landing-globe-dark.png',
  alt: '/assets/illustrations/landing/landing-globe-alt.png',
} as const;

function HomeIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 10.5 12 3l8.5 7.5v9a1.5 1.5 0 0 1-1.5 1.5H5a1.5 1.5 0 0 1-1.5-1.5v-9Z" /><path d="M9 21v-6h6v6" /></svg>;
}

function BookIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4.8c2.7-.9 5.3-.3 8 1.6v13c-2.7-1.9-5.3-2.5-8-1.6v-13Zm16 0c-2.7-.9-5.3-.3-8 1.6v13c2.7-1.9 5.3-2.5 8-1.6v-13Z" /></svg>;
}

function CapIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m2.5 9 9.5-5 9.5 5-9.5 5-9.5-5Z" /><path d="M6.5 11.3v5.2c2.9 2.3 8.1 2.3 11 0v-5.2M21.5 9v6" /></svg>;
}

function PeopleIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3" /><path d="M3.5 19c.4-3.4 2.2-5.2 5.5-5.2s5.1 1.8 5.5 5.2M16.2 5.8a2.7 2.7 0 0 1 0 5.2M16.2 13.6c2.7.2 4.1 1.9 4.3 4.6" /></svg>;
}

function GridIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="3.5" width="6.5" height="6.5" rx="1.3" /><rect x="14" y="3.5" width="6.5" height="6.5" rx="1.3" /><rect x="3.5" y="14" width="6.5" height="6.5" rx="1.3" /><rect x="14" y="14" width="6.5" height="6.5" rx="1.3" /></svg>;
}

function LandingWorldFallback() {
  return (
    <>
      <span className="landing-spark spark-one">✦</span>
      <span className="landing-spark spark-two">✦</span>
      <span className="landing-cloud cloud-one" />
      <span className="landing-cloud cloud-two" />
      <span className="landing-orbit orbit-back" />
      <div className="landing-world-globe">
        <svg viewBox="0 0 420 420" className="landing-world-map">
          <path className="continent continent-a" d="M61 118c25-43 73-65 123-59l24 24-11 32-35 15-16 29-34 4-16-22-30-3-5-20Zm109 69 38-19 32 10 11 27-17 18-6 31-28 9-16-19-30-10 16-47Z" />
          <path className="continent continent-b" d="M236 80c45-21 97-4 126 30l-2 32-24 11-17-12-28 8-11 27-25-6-18-27-20-6-5-27 24-30Zm47 113 30-18 34 9 11 30-17 24-6 35-27 23-22-12-8-33-20-26 25-32Z" />
          <path className="continent continent-c" d="m101 260 38-12 34 14 13 31-16 35-25 27-27-7-9-29-24-16 16-43Z" />
          <path className="continent continent-d" d="m329 281 23-8 16 14-4 24-25 9-17-15 7-24Z" />
        </svg>
        <span className="landing-world-shine" />
        <span className="landmark landmark-eiffel">
          <svg viewBox="0 0 32 48"><path d="M15.5 3 8 44M16.5 3 24 44M10.5 28h11M7.5 39h17M11.5 17h9M9 44h14" /></svg>
        </span>
        <span className="landmark landmark-torii">
          <svg viewBox="0 0 46 34"><path d="M5 7h36M9 12h28M13 12v18M33 12v18M8 30h30M17 12l-1 18M29 12l1 18" /></svg>
        </span>
        <span className="landmark landmark-tower">
          <svg viewBox="0 0 34 46"><path d="M10 43h14M12 43V13h10v30M10 13h14M13 9h8M15 4h4M16 16h2M16 23h2M16 30h2" /></svg>
        </span>
        <span className="landmark landmark-dome">
          <svg viewBox="0 0 44 34"><path d="M7 29h30M10 29v-8c0-7 5-12 12-12s12 5 12 12v8M18 9V5h8v4M15 22h14" /></svg>
        </span>
      </div>
      <span className="landing-orbit orbit-front" />
      <span className="landing-cloud cloud-three" />
    </>
  );
}

function LandingWorld({ appearance }: { appearance: ResolvedTheme }) {
  const [assetStage, setAssetStage] = useState<GlobeAssetStage>('theme');

  useEffect(() => {
    setAssetStage('theme');
  }, [appearance]);

  const assetSrc = assetStage === 'theme'
    ? LANDING_GLOBE_ASSETS[appearance]
    : assetStage === 'alt'
      ? LANDING_GLOBE_ASSETS.alt
      : null;

  return (
    <div className={`landing-world-scene${assetSrc ? ' uses-image-asset' : ' uses-css-fallback'}`} aria-hidden="true">
      {assetSrc ? (
        <img
          key={assetSrc}
          className="landing-world-asset"
          src={assetSrc}
          alt=""
          width="1254"
          height="1254"
          draggable={false}
          decoding="async"
          onError={() => {
            setAssetStage((stage) => stage === 'theme' ? 'alt' : 'fallback');
          }}
        />
      ) : (
        <LandingWorldFallback />
      )}
    </div>
  );
}

export function LandingPage({
  user,
  authReady,
  theme,
  resolvedTheme,
  onThemeChange,
  onStart,
}: LandingPageProps) {
  function scrollTo(target: NavTarget) {
    document.getElementById(target)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const ctaLabel = user ? 'Continue learning' : 'Start learning';

  return (
    <div className="landing-page" id="landing-top">
      <div className="landing-ambient landing-ambient-one" />
      <div className="landing-ambient landing-ambient-two" />

      <header className="landing-navbar">
        <button className="landing-brand" type="button" onClick={() => scrollTo('landing-top')} aria-label="Lingora home">
          <BrandMark />
          <span>Lingora</span>
        </button>

        <nav className="landing-nav" aria-label="Landing navigation">
          <button className="is-active" type="button" onClick={() => scrollTo('landing-top')}><HomeIcon /><span>Home</span></button>
          <button type="button" onClick={() => scrollTo('landing-languages')}><BookIcon /><span>Languages</span></button>
          <button type="button" onClick={() => scrollTo('landing-courses')}><CapIcon /><span>Courses</span></button>
          <button type="button" onClick={() => scrollTo('landing-about')}><PeopleIcon /><span>About</span></button>
        </nav>

        <ThemeToggle value={theme} onChange={onThemeChange} />
      </header>

      <main>
        <section className="landing-hero">
          <div className="landing-copy">
            <div className="landing-kicker"><span>✦</span>A brighter way to learn</div>
            <h1>
              <span>Languages</span>
              <span className="landing-gradient-title">open a brighter</span>
              <span>world</span>
            </h1>
            <p>Learn real languages. Meet new cultures.<br />See more of the world — and yourself.</p>

            <div className="landing-actions">
              <button className="landing-primary-cta" type="button" onClick={onStart} disabled={!authReady}>
                <span>{authReady ? ctaLabel : 'Checking account…'}</span>
                <span aria-hidden="true">→</span>
              </button>
              <button className="landing-secondary-cta" type="button" onClick={() => scrollTo('landing-languages')}>
                <GridIcon />
                <span>Explore languages</span>
              </button>
            </div>

            <div className="landing-note">
              <span className="landing-note-dot" />
              {user ? `Signed in as ${user.displayName || user.firstName || user.email}` : 'Google sign-in · Your progress stays with you'}
            </div>
          </div>

          <div className="landing-visual">
            <LandingWorld appearance={resolvedTheme} />
          </div>
        </section>

        <section className="landing-feature-strip" id="landing-languages">
          <article><span className="feature-icon">◎</span><strong>Explore naturally</strong><p>Discover languages through places, flags, and cultures instead of a flat catalog.</p></article>
          <article id="landing-courses"><span className="feature-icon">✦</span><strong>Learn with direction</strong><p>Move from discovery into structured courses while keeping your progress in one account.</p></article>
          <article id="landing-about"><span className="feature-icon">↗</span><strong>See more of the world</strong><p>Lingora connects language learning with the people and places that make each language alive.</p></article>
        </section>
      </main>
    </div>
  );
}
