/**
 * Accounts and sync (Firebase Auth + one Firestore document per user).
 * Firebase is only loaded when accounts are set up and someone signs in, so the
 * app stays small and fully usable without an account.
 */
import type { Auth, User } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore/lite';
import {
  applySyncData,
  clearLocalData,
  getState,
  getSyncData,
  readKv,
  sanitizeText,
  setAccount,
  setSyncStatus,
  subscribe,
  writeKv,
  type State,
} from '../store/store';
import { FIREBASE_CONFIG } from './config';
import { decodeDoc, encodeDoc, mergeData, type AccountDoc } from './doc';

export const accountsEnabled = FIREBASE_CONFIG !== null;
export const NAME_MAX = 30;
export const PASSWORD_MIN = 6;

type AuthModule = typeof import('firebase/auth');
type StoreModule = typeof import('firebase/firestore/lite');

interface Api {
  auth: Auth;
  db: Firestore;
  a: AuthModule;
  f: StoreModule;
}

let api: Promise<Api> | null = null;

function load(): Promise<Api> {
  if (!FIREBASE_CONFIG) return Promise.reject(new Error('accounts-disabled'));
  api ??= (async () => {
    const [{ initializeApp }, a, f] = await Promise.all([import('firebase/app'), import('firebase/auth'), import('firebase/firestore/lite')]);
    const app = initializeApp(FIREBASE_CONFIG);
    const auth = a.initializeAuth(app, { persistence: [a.indexedDBLocalPersistence, a.browserLocalPersistence] });
    const db = f.getFirestore(app);
    // Local test setup only (Firebase emulators); never set in the published build.
    const emulator = import.meta.env.VITE_FIREBASE_EMULATOR as string | undefined;
    if (emulator) {
      a.connectAuthEmulator(auth, `http://${emulator}:9099`, { disableWarnings: true });
      f.connectFirestoreEmulator(db, emulator, 8080);
    }
    a.onAuthStateChanged(auth, (user) => void onUser(user));
    return { auth, db, a, f };
  })();
  return api;
}

// ---------------------------------------------------------------- sync

const PUSH_DELAY_MS = 8000;
const PULL_AFTER_MS = 2 * 60 * 1000;
let pushTimer: ReturnType<typeof setTimeout> | undefined;
let busy = false;
let lastPull = 0;
let watching = false;

const docRef = (x: Api, uid: string) => x.f.doc(x.db, 'users', uid);

async function onUser(user: User | null) {
  if (!user) {
    setAccount(null);
    setSyncStatus({ state: 'off' });
    return;
  }
  setAccount({ uid: user.uid, email: user.email ?? '', name: user.displayName ?? '' });
  await pull();
}

/** Fetches the account, merges it with this device and writes the result back. */
export async function pull(): Promise<void> {
  const account = getState().account;
  if (!account || busy) return;
  busy = true;
  setSyncStatus({ state: 'syncing', at: getState().sync.at });
  try {
    const x = await load();
    const snap = await x.f.getDoc(docRef(x, account.uid));
    const local = getSyncData();
    const preferRemote = (await readKv<string>('syncUid')) !== account.uid;
    if (snap.exists()) {
      const remote = snap.data() as Partial<AccountDoc>;
      if (!account.name && remote.name) setAccount({ ...account, name: remote.name });
      await applySyncData(mergeData(local, decodeDoc(remote, local), preferRemote));
    }
    await writeKv('syncUid', account.uid);
    lastPull = Date.now();
    busy = false;
    await push();
  } catch (err) {
    busy = false;
    fail(err);
  }
}

/** Writes this device's data to the account now. */
export async function push(): Promise<void> {
  clearTimeout(pushTimer);
  const account = getState().account;
  if (!account) return;
  if (busy) {
    // A pull or push is running; try again shortly so this change isn't lost.
    pushTimer = setTimeout(() => void push(), 1500);
    return;
  }
  busy = true;
  setSyncStatus({ state: 'syncing', at: getState().sync.at });
  try {
    const x = await load();
    await x.f.setDoc(docRef(x, account.uid), { ...encodeDoc(getSyncData(), account.name), updatedAt: x.f.serverTimestamp() });
    setSyncStatus({ state: 'ok', at: Date.now() });
  } catch (err) {
    fail(err);
  } finally {
    busy = false;
  }
}

function fail(err: unknown) {
  console.warn('[smart-tok] sync failed', err);
  setSyncStatus({ state: 'error', at: getState().sync.at, error: errorCode(err) });
}

const synced = (s: State) => [s.cards, s.days, s.settings, s.prefs, s.algo, s.suggestions];

function watch() {
  if (watching) return;
  watching = true;
  let prev = synced(getState());
  subscribe(() => {
    const next = synced(getState());
    const changed = next.some((v, i) => v !== prev[i]);
    prev = next;
    if (!changed || !getState().account || busy) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => void push(), PUSH_DELAY_MS);
  });
  document.addEventListener('visibilitychange', () => {
    if (!getState().account) return;
    if (document.visibilityState === 'hidden' && pushTimer) void push();
    if (document.visibilityState === 'visible' && Date.now() - lastPull > PULL_AFTER_MS) void pull();
  });
}

/** Called on app start: only loads Firebase if this device was signed in before. */
export async function startAccounts(): Promise<void> {
  if (!accountsEnabled) return;
  watch();
  if (await readKv<string>('syncUid')) await load().catch(fail);
}

// ---------------------------------------------------------------- account actions

export function errorCode(err: unknown): string {
  const code = (err as { code?: string })?.code;
  return typeof code === 'string' ? code.replace(/^auth\//, '') : 'unknown';
}

export function cleanName(name: string): string {
  return sanitizeText(name, NAME_MAX);
}

export async function signUp(name: string, email: string, password: string): Promise<void> {
  const x = await load();
  watch();
  const clean = cleanName(name);
  const cred = await x.a.createUserWithEmailAndPassword(x.auth, email.trim(), password);
  await x.a.updateProfile(cred.user, { displayName: clean });
  setAccount({ uid: cred.user.uid, email: cred.user.email ?? '', name: clean });
  // A new account starts with what this device already has.
  await writeKv('syncUid', cred.user.uid);
  await push();
}

export async function signIn(email: string, password: string): Promise<void> {
  const x = await load();
  watch();
  await x.a.signInWithEmailAndPassword(x.auth, email.trim(), password);
}

export async function resetPassword(email: string): Promise<void> {
  const x = await load();
  x.auth.languageCode = getState().settings.lang;
  await x.a.sendPasswordResetEmail(x.auth, email.trim());
}

/** Saves everything to the account, signs out and clears this device. */
export async function signOut(): Promise<void> {
  const x = await load();
  await push();
  await x.a.signOut(x.auth);
  await clearLocalData();
}

export async function renameAccount(name: string): Promise<void> {
  const x = await load();
  const user = x.auth.currentUser;
  const account = getState().account;
  if (!user || !account) return;
  const clean = cleanName(name);
  await x.a.updateProfile(user, { displayName: clean });
  setAccount({ ...account, name: clean });
  await push();
}

/** Deletes the account and its data for good. Firebase may ask to sign in again first. */
export async function deleteAccount(): Promise<void> {
  const x = await load();
  const user = x.auth.currentUser;
  if (!user) return;
  await x.f.deleteDoc(docRef(x, user.uid));
  await x.a.deleteUser(user);
  await clearLocalData();
}
