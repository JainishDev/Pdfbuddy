// src/middleware.ts
// Astro only auto-loads a middleware file at this exact path, so this is
// just a thin re-export — the actual logic lives in src/middleware/auth.ts
// to keep it consistent with how every other feature area is organized.
export { onRequest } from './middleware/auth';
