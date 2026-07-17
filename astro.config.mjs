// @ts-check
import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: vercel({
    // Vercel handles function timeouts differently - max 60s on Pro, 10s on Hobby
    // We'll rely on Vercel's defaults and our application-level timeouts
  }),
});
