// src/pages/api/auth/me.ts
export const prerender = false;

import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ locals }) => {
  return new Response(JSON.stringify({ user: locals.user }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
