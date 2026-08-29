import app from './app.json';

// Plain object rather than the package's `defineConfig` helper, which is
// type-only: @vite-pwa/assets-generator is no longer a dependency (it pulled
// 24 MB of sharp plus a native build toolchain, and a sharp advisory that
// upgrading could not clear). Regenerate on demand with:
//
//   npm run generate-pwa-assets
//
// which fetches the generator through npx. The icons it produces are
// committed under public/fav/ and change roughly never.
export default {
  preset: {
    transparent: {
      sizes: app.iconSizes,
      favicons: [[64, 'favicon.ico']],
    },
    maskable: { sizes: app.iconSizes },
    apple: { sizes: [180] },
  },
  images: app.iconImages,
};
