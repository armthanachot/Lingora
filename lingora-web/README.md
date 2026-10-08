# lingora-web

React + Vite web UI for Lingora with a public pastel landing page, Google Identity Services sign-in, persistent API sessions, a theme-aware language globe, and a super-admin settings surface.

1. Run `rtk bun install`.
2. Copy `.env.example` to `.env` and set `VITE_API_BASE_URL` and `VITE_GOOGLE_CLIENT_ID`.
3. Run `rtk bun run dev`.

See `../docs/google.txt` for Google Auth Platform setup.

## Landing and app flow

- `#` / no hash is the public Lingora landing page.
- The landing CTA opens Google Sign-In when there is no current session.
- Successful sign-in routes to `#app`, which contains the interactive language globe.
- `#settings` is available only to signed-in super admins.
- Returning to the Lingora brand from the globe returns to the public landing page without signing the user out.

## Theme

Lingora supports three theme preferences: `light`, `auto`, and `dark`.

- `auto` follows `prefers-color-scheme` and reacts when the device setting changes.
- The preference is stored in `localStorage` under `lingora-theme`.
- An inline bootstrap in `index.html` resolves the theme before React renders to reduce theme flash.
- Theme changes affect UI surfaces, icons, the landing illustration, Google Sign-In treatment, and the globe ocean/land/atmosphere palette.

The UI currently requests **Plus Jakarta Sans** from Google Fonts and falls back to system sans-serif fonts.

Landing hero artwork is theme-aware and looks for these transparent PNG assets:

- `public/assets/illustrations/landing/landing-globe-light.png`
- `public/assets/illustrations/landing/landing-globe-dark.png`
- `public/assets/illustrations/landing/landing-globe-alt.png`

The resolved light/dark theme chooses the first two. The alt asset is the image fallback; if it is also unavailable, the landing page falls back to the CSS/SVG globe so local development is not blocked while artwork is being added.

## Authentication

Google Sign-In sends the Google ID token to `POST /api/v1/auth/google`. The API verifies it and sets an HttpOnly Lingora session cookie. All API requests use `credentials: include`, and `GET /api/v1/auth/me` restores the signed-in user after a page refresh.

A new account has no Lingora `displayName`. The UI shows a blocking profile-completion modal after sign-in until the user chooses one.

Super admins see a gear button in the signed-in account controls. The Settings page is also protected by the API, so hiding/showing the gear is not the security boundary.

## Settings

Settings contains separate menus for:
- Users
- Languages
- Countries
- Country languages
- Courses
- Modules
- Lessons
- Enrollments
- Progress

User management supports editing `displayName` and toggling `isSuperAdmin`. Master-data menus support create, inline editing, per-row confirmed save, confirmed transactional save-all, and confirmed soft delete. Primary keys and automatic timestamp fields are read-only; dirty rows enable the row checkmark and the global Save all changes button.

## Interactive globe

The signed-in app uses `react-globe.gl` for drag/rotate/zoom interaction. Country/language markers come from `GET /api/v1/home/globe`.

- Zoomed-out markers cluster into count bubbles.
- Crossing a zoom threshold splits/merges markers with a short animation.
- Natural Earth country polygons are bundled through `world-atlas` and converted with `topojson-client`.
- Active countries are brighter, inactive countries are muted, and the selected country lifts from the globe with a cinematic camera framing.
- The ocean texture, land colors, atmosphere, markers, cards, and surrounding app UI respond to the resolved light/dark theme.
