# lucide-react shim

This project currently aliases `lucide-react` to `src/lib/lucideReactShim.jsx` in `vite.config.js` so local builds do not fail when the npm registry blocks the real package. In this environment, `npm install lucide-react` returns `403 Forbidden`, so the shim stays active as a temporary fallback.

## When to keep the shim

Keep the shim when CI or the local environment cannot fetch `lucide-react` from the registry. The shim exports the icon names currently used by the app and renders a simple accessible SVG fallback so imports do not crash the build.

## Migrating to real lucide-react

When registry access is available:

1. Run `npm install lucide-react`.
2. Remove the `lucide-react` alias from `vite.config.js`.
3. Delete `src/lib/lucideReactShim.jsx` if no tests depend on it.
4. Run `npm run build` and focused UI tests.

Do not keep both the alias and the dependency long-term; the alias wins during Vite resolution and would hide the real package.
