export function BrandMark() {
  return (
    <span className="lingora-brand-mark" aria-hidden="true">
      <svg viewBox="0 0 48 48">
        <defs>
          <linearGradient id="lingora-planet-gradient" x1="8" y1="7" x2="39" y2="41" gradientUnits="userSpaceOnUse">
            <stop stopColor="var(--brand-cyan)" />
            <stop offset=".52" stopColor="var(--brand-blue)" />
            <stop offset="1" stopColor="var(--brand-violet)" />
          </linearGradient>
        </defs>
        <circle cx="23.5" cy="24" r="13.5" fill="url(#lingora-planet-gradient)" />
        <path className="brand-land" d="M14.2 19.5c3-4.8 9.2-7.1 14.6-4.6l-2.2 3.3-4.4.6-1.5 3.2-4.2.7-2.3-3.2Zm18.5 5.2c.7 4.3-1.9 8.8-5.9 10.5l-2.1-2.6.8-4.2 3.5-1.3 1.4-2.9 2.3.5Z" />
        <ellipse cx="23.5" cy="24" rx="21" ry="7.1" className="brand-ring" transform="rotate(-18 23.5 24)" />
        <path className="brand-spark" d="m38 5.5 1.15 3.1 3.1 1.15-3.1 1.15L38 14l-1.15-3.1-3.1-1.15 3.1-1.15L38 5.5Z" />
      </svg>
    </span>
  );
}
