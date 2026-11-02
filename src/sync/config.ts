/**
 * Firebase web app settings from the Firebase console (Project settings → Your apps).
 * These values are public by design: what each account may read and write is
 * enforced by the rules in `firestore.rules`, not by keeping this secret.
 * `null` means accounts are not set up yet; the app then works on this device only.
 */
export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
  storageBucket?: string;
  messagingSenderId?: string;
}

function fromEnv(): FirebaseConfig | null {
  const raw = import.meta.env.VITE_FIREBASE_CONFIG as string | undefined;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as FirebaseConfig;
  } catch {
    return null;
  }
}

/** Filled in once the Firebase project exists (see docs/firebase-setup.md). */
const PROJECT_CONFIG: FirebaseConfig | null = {
  apiKey: 'AIzaSyBI5O9xh_dHi30_hYICkdQFdoZtzsI73UQ',
  authDomain: 'smart-tok-29d06.firebaseapp.com',
  projectId: 'smart-tok-29d06',
  storageBucket: 'smart-tok-29d06.firebasestorage.app',
  messagingSenderId: '285805374385',
  appId: '1:285805374385:web:468ff785456b4bfdd9ab90',
};

export const FIREBASE_CONFIG: FirebaseConfig | null = fromEnv() ?? PROJECT_CONFIG;
