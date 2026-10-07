import { defineConfig, fontProviders } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

// GitHub user site: served from the domain root, so no `base`.
export default defineConfig({
  site: 'https://exoxeph.github.io',
  output: 'static',
  trailingSlash: 'always',
  // Inline the CSS: it is render-blocking either way, and an external sheet costs a round trip before first paint
  // (measured on the mobile Lighthouse profile: FCP 1.6 s to 1.37 s, LCP 2.25 s to 2.10 s on the home page). GitHub Pages
  // serves every asset with the same short cache lifetime, so a separate cached stylesheet buys little.
  build: { format: 'directory', inlineStylesheets: 'always' },
  integrations: [mdx(), sitemap()],
  fonts: [
    {
      provider: fontProviders.local(),
      name: 'Newsreader',
      cssVariable: '--font-serif',
      fallbacks: ['Georgia', 'Times New Roman', 'serif'],
      options: {
        variants: [
          {
            // Instanced from the full 200 to 800 file: the site only uses weights 400 to 700.
            weight: '400 700',
            style: 'normal',
            src: ['./src/assets/fonts/newsreader-latin-wght-normal.woff2'],
          },
        ],
      },
    },
    {
      provider: fontProviders.local(),
      name: 'IBM Plex Sans',
      cssVariable: '--font-sans',
      fallbacks: ['system-ui', 'Segoe UI', 'sans-serif'],
      options: {
        variants: [
          { weight: 400, style: 'normal', src: ['./src/assets/fonts/ibm-plex-sans-latin-400-normal.woff2'] },
          { weight: 500, style: 'normal', src: ['./src/assets/fonts/ibm-plex-sans-latin-500-normal.woff2'] },
        ],
      },
    },
    {
      provider: fontProviders.local(),
      name: 'IBM Plex Mono',
      cssVariable: '--font-mono',
      fallbacks: ['ui-monospace', 'Consolas', 'monospace'],
      options: {
        variants: [
          { weight: 400, style: 'normal', src: ['./src/assets/fonts/ibm-plex-mono-latin-400-normal.woff2'] },
          { weight: 500, style: 'normal', src: ['./src/assets/fonts/ibm-plex-mono-latin-500-normal.woff2'] },
        ],
      },
    },
    {
      provider: fontProviders.local(),
      name: 'Comic Neue',
      cssVariable: '--font-note',
      fallbacks: ['Comic Sans MS', 'Chalkboard SE', 'cursive'],
      options: {
        variants: [{ weight: 700, style: 'normal', src: ['./src/assets/fonts/comic-neue-latin-700-normal.woff2'] }],
      },
    },
  ],
});
