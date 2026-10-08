import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Globe, { type GlobeMethods } from 'react-globe.gl';
import { feature } from 'topojson-client';
import worldAtlas from 'world-atlas/countries-110m.json';
import { BrandMark } from '../../components/BrandMark';
import type { ResolvedTheme } from '../theme/theme';
import { globeHomeApi, type GlobeCountry, type GlobeHomePayload, type PopularLanguage } from '.';

type WorldPolygon = {
  id?: string | number;
  properties?: { name?: string };
  geometry: object;
};

type AtlasTopology = {
  objects: { countries: object };
};

const atlasTopology = worldAtlas as unknown as AtlasTopology;
const WORLD_POLYGONS = (
  feature(atlasTopology as never, atlasTopology.objects.countries as never) as unknown as { features: WorldPolygon[] }
).features.filter(
  (polygon) => String(polygon.id) !== '010' && String(polygon.id) !== '10' && polygon.properties?.name !== 'Antarctica',
);

type GlobeMarker =
  | {
      kind: 'country';
      lat: number;
      lng: number;
      country: GlobeCountry;
    }
  | {
      kind: 'cluster';
      lat: number;
      lng: number;
      countries: GlobeCountry[];
    };

type GlobeExplorerProps = {
  accountSlot?: ReactNode;
  appearance: ResolvedTheme;
  onBackToLanding?: () => void;
};

const INITIAL_ALTITUDE = 2.05;
const CINEMATIC_FOCUS_ALTITUDE = 0.92;
const CINEMATIC_LATITUDE_OFFSET = 13;
const CINEMATIC_LONGITUDE_OFFSET = 8;

function clampLatitude(latitude: number) {
  return Math.max(-76, Math.min(76, latitude));
}

function wrapLongitude(longitude: number) {
  return ((longitude + 180) % 360 + 360) % 360 - 180;
}
function buildOceanTexture(theme: ResolvedTheme) {
  const colors = theme === 'dark'
    ? { edge: '#17385f', center: '#285b85', top: '#8c84f7', bottom: '#091a37' }
    : { edge: '#8ecdf4', center: '#bdeeff', top: '#e8f7ff', bottom: '#6aaee7' };

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="1024" height="512" viewBox="0 0 1024 512">
      <defs>
        <linearGradient id="ocean-horizontal" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="${colors.edge}"/>
          <stop offset="0.5" stop-color="${colors.center}"/>
          <stop offset="1" stop-color="${colors.edge}"/>
        </linearGradient>
        <linearGradient id="ocean-vertical" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="${colors.top}" stop-opacity="${theme === 'dark' ? '.18' : '.28'}"/>
          <stop offset="0.48" stop-color="#ffffff" stop-opacity="0"/>
          <stop offset="1" stop-color="${colors.bottom}" stop-opacity="${theme === 'dark' ? '.34' : '.16'}"/>
        </linearGradient>
      </defs>
      <rect width="1024" height="512" fill="url(#ocean-horizontal)"/>
      <rect width="1024" height="512" fill="url(#ocean-vertical)"/>
    </svg>
  `)}`;
}

const OCEAN_TEXTURES = {
  light: buildOceanTexture('light'),
  dark: buildOceanTexture('dark'),
};

const LIGHT_LAND_COLORS = [
  'rgba(158, 216, 178, .97)',
  'rgba(199, 184, 238, .97)',
  'rgba(243, 201, 139, .97)',
  'rgba(150, 205, 232, .97)',
  'rgba(239, 175, 201, .96)',
  'rgba(196, 217, 137, .97)',
];

const DARK_LAND_COLORS = [
  'rgba(79, 143, 124, .98)',
  'rgba(111, 100, 171, .98)',
  'rgba(177, 129, 76, .98)',
  'rgba(72, 132, 166, .98)',
  'rgba(168, 91, 127, .98)',
  'rgba(126, 151, 76, .98)',
];

const COUNTRY_NAME_ALIASES: Record<string, string> = {
  'united states of america': 'united states',
  'russian federation': 'russia',
  'republic of korea': 'south korea',
  'korea, republic of': 'south korea',
  'viet nam': 'vietnam',
};

function normalizeCountryName(value: string) {
  const normalized = value.trim().toLocaleLowerCase();
  return COUNTRY_NAME_ALIASES[normalized] ?? normalized;
}

function paletteIndex(value: string) {
  let hash = 0;
  for (const character of value) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return hash % LIGHT_LAND_COLORS.length;
}

function markerDelay(value: string) {
  return (paletteIndex(value) % 5) * 34;
}

function shadeRgba(color: string, factor: number, alpha: number) {
  const match = color.match(/rgba?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)/i);
  if (!match) return color;

  const [, red, green, blue] = match;
  const shade = (value: string) => Math.max(0, Math.min(255, Math.round(Number(value) * factor)));

  return `rgba(${shade(red)}, ${shade(green)}, ${shade(blue)}, ${alpha})`;
}

function clusterCellSize(altitude: number) {
  if (altitude >= 1.85) return 42;
  if (altitude >= 1.45) return 30;
  if (altitude >= 1.15) return 20;
  return 0;
}

function buildMarkers(countries: GlobeCountry[], cellSize: number): GlobeMarker[] {
  if (cellSize === 0) {
    return countries.map((country) => ({
      kind: 'country',
      lat: country.latitude,
      lng: country.longitude,
      country,
    }));
  }

  const groups = new Map<string, GlobeCountry[]>();
  for (const country of countries) {
    const latKey = Math.floor((country.latitude + 90) / cellSize);
    const lngKey = Math.floor((country.longitude + 180) / cellSize);
    const key = `${latKey}:${lngKey}`;
    const group = groups.get(key) ?? [];
    group.push(country);
    groups.set(key, group);
  }

  return [...groups.values()].map((group) => {
    if (group.length === 1) {
      const [country] = group;
      return {
        kind: 'country' as const,
        lat: country.latitude,
        lng: country.longitude,
        country,
      };
    }

    return {
      kind: 'cluster' as const,
      lat: group.reduce((sum, country) => sum + country.latitude, 0) / group.length,
      lng: group.reduce((sum, country) => sum + country.longitude, 0) / group.length,
      countries: group,
    };
  });
}

function countryPrimaryLanguage(country: GlobeCountry) {
  return country.languages.find((language) => language.isPrimary) ?? country.languages[0] ?? null;
}

export function GlobeExplorer({ accountSlot, appearance, onBackToLanding }: GlobeExplorerProps) {
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const globeHostRef = useRef<HTMLDivElement>(null);
  const [payload, setPayload] = useState<GlobeHomePayload>({ countries: [], popularLanguages: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedCountry, setSelectedCountry] = useState<GlobeCountry | null>(null);
  const cameraAltitudeRef = useRef(INITIAL_ALTITUDE);
  const [clusterCell, setClusterCell] = useState(() => clusterCellSize(INITIAL_ALTITUDE));
  const [markerMotion, setMarkerMotion] = useState<'idle' | 'split' | 'merge'>('idle');
  const clusterCellRef = useRef(clusterCellSize(INITIAL_ALTITUDE));
  const [query, setQuery] = useState('');
  const [globeSize, setGlobeSize] = useState({ width: 700, height: 640 });

  useEffect(() => {
    let cancelled = false;
    void globeHomeApi
      .get()
      .then((data) => {
        if (cancelled) return;
        setPayload(data);
        setError('');
      })
      .catch((requestError: unknown) => {
        if (cancelled) return;
        setError(requestError instanceof Error ? requestError.message : String(requestError));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const host = globeHostRef.current;
    if (!host) return;

    const updateSize = () => {
      const rect = host.getBoundingClientRect();
      const width = Math.max(320, Math.round(rect.width));
      const height = Math.max(440, Math.min(700, Math.round(rect.height || rect.width * 0.88)));
      setGlobeSize({ width, height });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  const markers = useMemo(
    () => buildMarkers(payload.countries, clusterCell),
    [payload.countries, clusterCell],
  );

  const countryByName = useMemo(() => {
    const map = new Map<string, GlobeCountry>();
    for (const country of payload.countries) map.set(normalizeCountryName(country.name), country);
    return map;
  }, [payload.countries]);

  const countryForPolygon = useCallback((polygon: WorldPolygon) => {
    const name = polygon.properties?.name;
    return name ? countryByName.get(normalizeCountryName(name)) : undefined;
  }, [countryByName]);

  const polygonColor = useCallback((polygon: WorldPolygon) => {
    const name = polygon.properties?.name ?? String(polygon.id ?? 'world');
    const country = countryForPolygon(polygon);

    if (country?.status === 'inactive') {
      return appearance === 'dark' ? 'rgba(74, 82, 105, .9)' : 'rgba(205, 211, 225, .86)';
    }

    const palette = appearance === 'dark' ? DARK_LAND_COLORS : LIGHT_LAND_COLORS;
    return palette[paletteIndex(name)];
  }, [appearance, countryForPolygon]);

  const polygonAltitude = useCallback((polygon: WorldPolygon) => {
    const country = countryForPolygon(polygon);
    return country && selectedCountry?.id === country.id ? 0.055 : 0.006;
  }, [countryForPolygon, selectedCountry]);

  const polygonSideColor = useCallback((polygon: WorldPolygon) => {
    const country = countryForPolygon(polygon);

    if (country && selectedCountry?.id === country.id) {
      return shadeRgba(
        polygonColor(polygon),
        appearance === 'dark' ? 0.62 : 0.74,
        appearance === 'dark' ? 0.92 : 0.86,
      );
    }

    return appearance === 'dark' ? 'rgba(13, 22, 43, .45)' : 'rgba(116, 135, 176, .08)';
  }, [appearance, countryForPolygon, polygonColor, selectedCountry]);

  const polygonStrokeColor = useCallback((polygon: WorldPolygon) => {
    const country = countryForPolygon(polygon);
    if (country && selectedCountry?.id === country.id) {
      return appearance === 'dark' ? 'rgba(229, 235, 255, .58)' : 'rgba(255, 255, 255, .86)';
    }
    return appearance === 'dark' ? 'rgba(205, 216, 255, .16)' : 'rgba(255, 255, 255, .62)';
  }, [appearance, countryForPolygon, selectedCountry]);

  const normalizedQuery = query.trim().toLocaleLowerCase();
  const searchMatches = useMemo(() => {
    if (!normalizedQuery) return [];
    return payload.countries
      .filter((country) => {
        const languageMatch = country.languages.some((language) =>
          `${language.name} ${language.nativeName}`.toLocaleLowerCase().includes(normalizedQuery),
        );
        return (
          country.name.toLocaleLowerCase().includes(normalizedQuery) ||
          country.nativeName?.toLocaleLowerCase().includes(normalizedQuery) ||
          languageMatch
        );
      })
      .slice(0, 6);
  }, [normalizedQuery, payload.countries]);

  const focusCountry = useCallback((country: GlobeCountry) => {
    setSelectedCountry(country);
    setQuery('');

    const globe = globeRef.current;
    const controls = globe?.controls();
    if (controls) controls.autoRotate = false;

    const hostWidth = globeHostRef.current?.clientWidth ?? 700;
    const compactView = hostWidth < 680;
    const latitudeOffset = compactView ? 8 : CINEMATIC_LATITUDE_OFFSET;
    const longitudeOffset = compactView ? 4 : CINEMATIC_LONGITUDE_OFFSET;
    const altitude = compactView
      ? 1.02
      : Math.max(0.84, Math.min(CINEMATIC_FOCUS_ALTITUDE, cameraAltitudeRef.current));

    globe?.pointOfView(
      {
        lat: clampLatitude(country.latitude - latitudeOffset),
        lng: wrapLongitude(country.longitude + longitudeOffset),
        altitude,
      },
      1050,
    );
  }, []);

  const focusLanguage = useCallback((language: PopularLanguage) => {
    const country = payload.countries.find(
      (candidate) =>
        candidate.status === 'active' &&
        candidate.languages.some((candidateLanguage) => candidateLanguage.id === language.id),
    );
    if (country) focusCountry(country);
  }, [focusCountry, payload.countries]);

  const zoomGlobe = useCallback((direction: 'in' | 'out') => {
    const globe = globeRef.current;
    if (!globe) return;
    const current = globe.pointOfView();
    const controls = globe.controls();
    controls.autoRotate = false;
    const altitude = direction === 'in'
      ? Math.max(0.72, current.altitude * 0.72)
      : Math.min(3.1, current.altitude * 1.38);
    globe.pointOfView({ altitude }, 450);
  }, []);

  const makeMarker = useCallback((markerData: GlobeMarker) => {
    const button = document.createElement('button');
    const visual = document.createElement('span');
    const motionClass = markerMotion === 'idle' ? '' : ` marker-${markerMotion}`;
    button.type = 'button';
    button.style.opacity = '0';
    button.style.visibility = 'hidden';
    button.style.pointerEvents = 'none';
    visual.className = 'globe-marker-visual';

    if (markerData.kind === 'cluster') {
      button.className = `globe-marker globe-cluster${motionClass}`;
      button.style.setProperty('--marker-delay', `${markerDelay(markerData.countries[0]?.code ?? 'cluster')}ms`);
      visual.textContent = String(markerData.countries.length);
      button.appendChild(visual);
      button.setAttribute('aria-label', `Zoom into ${markerData.countries.length} countries`);
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        globeRef.current?.pointOfView(
          {
            lat: markerData.lat,
            lng: markerData.lng,
            altitude: Math.max(0.85, cameraAltitudeRef.current * 0.62),
          },
          700,
        );
      });
      return button;
    }

    const { country } = markerData;
    const active = country.status === 'active';
    const selected = selectedCountry?.id === country.id;
    button.className = `globe-marker flag-marker${active ? '' : ' is-inactive'}${selected ? ' is-selected' : ''}${motionClass}`;
    button.style.setProperty('--marker-delay', `${markerDelay(country.code)}ms`);
    button.setAttribute('aria-label', `${country.name}${active ? '' : ', coming soon'}`);

    if (country.flag.imageUrl) {
      const image = document.createElement('img');
      image.src = country.flag.imageUrl;
      image.alt = '';
      image.loading = 'lazy';
      visual.appendChild(image);
    } else {
      const emoji = document.createElement('span');
      emoji.textContent = country.flag.emoji;
      emoji.setAttribute('aria-hidden', 'true');
      visual.appendChild(emoji);
    }

    button.appendChild(visual);
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      focusCountry(country);
    });
    return button;
  }, [focusCountry, markerMotion, selectedCountry]);

  const primaryLanguage = selectedCountry ? countryPrimaryLanguage(selectedCountry) : null;
  const selectedIsActive = selectedCountry?.status === 'active';

  return (
    <div className="home-page">
      <header className="site-header">
        <button className="brand app-brand-button" type="button" onClick={onBackToLanding} aria-label="Back to Lingora landing page">
          <BrandMark />
          <span>Lingora</span>
        </button>
        <nav className="site-nav" aria-label="Primary navigation">
          <a href="#courses">Courses / My learning</a>
          <button className="is-active" type="button" onClick={() => document.getElementById('app-top')?.scrollIntoView({ behavior: 'smooth' })}>Home</button>
          <button type="button" onClick={() => document.getElementById('app-explore')?.scrollIntoView({ behavior: 'smooth' })}>Explore</button>
          <button type="button" onClick={() => document.getElementById('app-how-it-works')?.scrollIntoView({ behavior: 'smooth' })}>How it works</button>
        </nav>
        <div className="account-slot">{accountSlot}</div>
      </header>

      <main id="app-top" className="home-main">
        <section className="hero-copy" aria-labelledby="home-heading">
          <span className="hero-kicker"><span aria-hidden="true">✦</span>Discover a language. Meet its world.</span>
          <h1 id="home-heading">
            <span>Explore languages</span>
            <span className="app-gradient-title">around the world.</span>
          </h1>
          <p className="hero-subtitle">
            Spin the globe, discover countries, and choose the language journey that feels right for you.
          </p>

          <div className="search-wrap">
            <label className="sr-only" htmlFor="language-search">Search for a country or language</label>
            <div className="search-box">
              <span aria-hidden="true">⌕</span>
              <input
                id="language-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search for a country or language..."
                autoComplete="off"
              />
            </div>
            {normalizedQuery && (
              <div className="search-results" role="listbox" aria-label="Search results">
                {searchMatches.length > 0 ? searchMatches.map((country) => {
                  const language = countryPrimaryLanguage(country);
                  return (
                    <button key={country.id} type="button" onClick={() => focusCountry(country)}>
                      <span className="search-result-flag">{country.flag.emoji}</span>
                      <span><strong>{country.name}</strong><small>{language?.name ?? 'Language coming soon'}</small></span>
                      <span aria-hidden="true">→</span>
                    </button>
                  );
                }) : <p>No country or language found yet.</p>}
              </div>
            )}
          </div>

          {payload.popularLanguages.length > 0 && (
            <div className="popular-languages" aria-label="Popular languages">
              <span>Popular languages</span>
              <div>
                {payload.popularLanguages.slice(0, 5).map((language) => (
                  <button key={language.id} type="button" onClick={() => focusLanguage(language)}>
                    {language.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="hero-meta" id="app-how-it-works">
            <span><strong>{payload.countries.length || '—'}</strong> places to explore</span>
            <span><strong>Drag</strong> to rotate</span>
            <span><strong>Scroll</strong> to zoom</span>
          </div>
        </section>

        <section id="app-explore" className="globe-stage" aria-label="Interactive language globe">
          <div className="pastel-blob pastel-blob-one" />
          <div className="pastel-blob pastel-blob-two" />
          <div className="globe-hint">Drag · rotate · zoom</div>
          <div className="zoom-controls" aria-label="Globe zoom controls">
            <button type="button" aria-label="Zoom in" onClick={() => zoomGlobe('in')}>+</button>
            <button type="button" aria-label="Zoom out" onClick={() => zoomGlobe('out')}>−</button>
          </div>
          <div
            className="globe-host"
            ref={globeHostRef}
            onPointerDown={() => {
              const controls = globeRef.current?.controls();
              if (controls) controls.autoRotate = false;
            }}
          >
            <Globe
              ref={globeRef}
              width={globeSize.width}
              height={globeSize.height}
              backgroundColor="rgba(0,0,0,0)"
              globeImageUrl={OCEAN_TEXTURES[appearance]}
              showAtmosphere
              atmosphereColor={appearance === 'dark' ? '#6670c9' : '#d7dcff'}
              atmosphereAltitude={0.18}
              polygonsData={WORLD_POLYGONS}
              polygonCapColor={(polygon) => polygonColor(polygon as WorldPolygon)}
              polygonSideColor={(polygon) => polygonSideColor(polygon as WorldPolygon)}
              polygonStrokeColor={(polygon) => polygonStrokeColor(polygon as WorldPolygon)}
              polygonAltitude={(polygon) => polygonAltitude(polygon as WorldPolygon)}
              polygonLabel={(polygon) => {
                const worldPolygon = polygon as WorldPolygon;
                const name = worldPolygon.properties?.name ?? '';
                const country = countryForPolygon(worldPolygon);
                return country ? `${name} · ${country.status === 'active' ? 'Available' : 'Coming soon'}` : name;
              }}
              polygonsTransitionDuration={620}
              onPolygonClick={(polygon) => {
                const country = countryForPolygon(polygon as WorldPolygon);
                if (country) focusCountry(country);
              }}
              htmlElementsData={markers}
              htmlLat={(data) => (data as GlobeMarker).lat}
              htmlLng={(data) => (data as GlobeMarker).lng}
              htmlAltitude={(data) => {
                const marker = data as GlobeMarker;
                if (marker.kind === 'country' && selectedCountry?.id === marker.country.id) return 0.092;
                return marker.kind === 'cluster' ? 0.04 : 0.035;
              }}
              htmlTransitionDuration={520}
              htmlElement={(data) => makeMarker(data as GlobeMarker)}
              htmlElementVisibilityModifier={(element, visible) => {
                element.style.visibility = visible ? 'visible' : 'hidden';
                element.style.opacity = visible ? '1' : '0';
                element.style.pointerEvents = visible ? 'auto' : 'none';
              }}
              onGlobeReady={() => {
                const controls = globeRef.current?.controls();
                if (controls) {
                  controls.autoRotate = true;
                  controls.autoRotateSpeed = 0.32;
                  controls.enableDamping = true;
                  controls.dampingFactor = 0.08;
                }
                globeRef.current?.pointOfView({ lat: 20, lng: 18, altitude: INITIAL_ALTITUDE }, 0);
              }}
              onZoom={(pointOfView) => {
                const nextCell = clusterCellSize(pointOfView.altitude);
                const previousCell = clusterCellRef.current;
                if (nextCell !== previousCell) {
                  setMarkerMotion(nextCell < previousCell ? 'split' : 'merge');
                  clusterCellRef.current = nextCell;
                  setClusterCell(nextCell);
                }
                cameraAltitudeRef.current = pointOfView.altitude;
              }}
            />
          </div>

          {loading && <div className="globe-status">Loading the world…</div>}
          {error && <div className="globe-status globe-error">Could not load globe data: {error}</div>}
          {!loading && !error && payload.countries.length === 0 && (
            <div className="globe-status">No countries in the globe catalog yet.</div>
          )}

          <div className="status-legend" aria-label="Map marker legend">
            <span><i className="legend-dot is-active" /> Active</span>
            <span><i className="legend-dot is-inactive" /> Coming soon</span>
          </div>

          {selectedCountry && (
            <aside className="country-card" aria-live="polite">
              <button
                className="country-card-close"
                type="button"
                aria-label="Close country details"
                onClick={() => setSelectedCountry(null)}
              >×</button>
              <div className="country-card-heading">
                <div className={`country-card-flag${selectedIsActive ? '' : ' is-inactive'}`}>
                  {selectedCountry.flag.imageUrl ? (
                    <img src={selectedCountry.flag.imageUrl} alt="" />
                  ) : (
                    <span>{selectedCountry.flag.emoji}</span>
                  )}
                </div>
                <div>
                  <div className={`country-card-status${selectedIsActive ? '' : ' is-inactive'}`}>
                    {selectedIsActive ? 'Available now' : 'Coming soon'}
                  </div>
                  <h2>{selectedCountry.name}</h2>
                  <p>{primaryLanguage?.name ?? 'Language details coming soon'}</p>
                </div>
              </div>

              {selectedCountry.languages.length > 1 && (
                <div className="country-language-list">
                  {selectedCountry.languages.map((language) => <a key={language.id} href={language.course ? `#courses/${language.course.id}` : "#courses"}>{language.name}</a>)}
                </div>
              )}

              <div className="vocab-country-actions">
              {selectedIsActive && primaryLanguage?.course ? (
                <a className="primary-cta" href={`#courses/${primaryLanguage.course.id}`}>
                  Start learning <span aria-hidden="true">→</span>
                </a>
              ) : selectedIsActive ? (
                <button className="primary-cta" type="button" disabled>Course setup pending</button>
              ) : (
                <button className="primary-cta" type="button" disabled>Coming soon</button>
              )}
              {selectedIsActive && primaryLanguage && <a className="vocab-globe-link" href={`#vocab/${primaryLanguage.id}`}>Explore vocab <span aria-hidden="true">✦</span></a>}
              </div>
            </aside>
          )}
        </section>
      </main>

    </div>
  );
}
