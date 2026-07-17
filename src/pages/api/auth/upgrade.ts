// src/pages/api/auth/upgrade.ts
// Called after a user upgrades from anonymous → real account.
// Currently a no-op stub since PDF Buddy is stateless (no server-side
// user data to migrate), but kept so auth.ts's upgradeAccount() doesn't
// hit a 404 and log an error in production.
export const prerender = false;

import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ locals }) => {
  // If we ever add server-side per-user storage (e.g. Firestore upload history),
  // move ownership from previousUid → locals.user.uid here.
  // For now, just acknowledge the call so the client doesn't see a 404.
  return new Response(JSON.stringify({ ok: true, migrated: false }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
