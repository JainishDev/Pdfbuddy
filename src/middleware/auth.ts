// src/middleware/auth.ts
// Runs on every request. Attaches `locals.user` (or null) so API routes can
// do `const { user } = locals` without each one re-verifying the token.
// Never blocks unauthenticated requests here — individual routes decide
// whether they require a signed-in user; most of PDF Buddy works fine
// with `user === null` (anonymous / Firebase not configured at all).

import { defineMiddleware } from 'astro:middleware';
import { verifyIdToken } from '../lib/firebase-admin';

export const onRequest = defineMiddleware(async (context, next) => {
  context.locals.user = null;

  const authHeader = context.request.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (token) {
    context.locals.user = await verifyIdToken(token);
  }

  return next();
});
