/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly GEMINI_API_KEY: string;

  readonly PUBLIC_FIREBASE_API_KEY: string;
  readonly PUBLIC_FIREBASE_AUTH_DOMAIN: string;
  readonly PUBLIC_FIREBASE_PROJECT_ID: string;
  readonly PUBLIC_FIREBASE_STORAGE_BUCKET: string;
  readonly PUBLIC_FIREBASE_MESSAGING_SENDER_ID: string;
  readonly PUBLIC_FIREBASE_APP_ID: string;

  readonly FIREBASE_ADMIN_PROJECT_ID: string;
  readonly FIREBASE_ADMIN_CLIENT_EMAIL: string;
  readonly FIREBASE_ADMIN_PRIVATE_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** Shape of the Firebase user info attached to `locals` by src/middleware/auth.ts */
type AuthedUser = {
  uid: string;
  email: string | null;
  isAnonymous: boolean;
};

declare namespace App {
  interface Locals {
    /** Populated by src/middleware/auth.ts when a valid Firebase ID token is present. */
    user: AuthedUser | null;
  }
}
