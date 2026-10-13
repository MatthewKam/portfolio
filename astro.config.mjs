import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import mdx from '@astrojs/mdx';

export default defineConfig({
  site: 'https://example.com', // TODO: set your real domain
  integrations: [react(), mdx()],
});
