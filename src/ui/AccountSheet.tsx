import { useEffect, useState, type FormEvent } from 'react';
import { useT, type StringKey } from '../i18n/strings';
import { useStore } from '../store/store';
import {
  accountsEnabled,
  cleanName,
  deleteAccount,
  errorCode,
  NAME_MAX,
  PASSWORD_MIN,
  push,
  renameAccount,
  resetPassword,
  signIn,
  signOut,
  signUp,
} from '../sync/account';
import { Icon } from './Icon';
import { Sheet } from './Sheet';

const ERRORS: Record<string, StringKey> = {
  'invalid-credential': 'errInvalidCredential',
  'wrong-password': 'errInvalidCredential',
  'user-not-found': 'errInvalidCredential',
  'invalid-login-credentials': 'errInvalidCredential',
  'email-already-in-use': 'errEmailInUse',
  'weak-password': 'errWeakPassword',
  'invalid-email': 'errInvalidEmail',
  'missing-email': 'errInvalidEmail',
  'too-many-requests': 'errTooMany',
  'network-request-failed': 'errNetwork',
  'requires-recent-login': 'errRecentLogin',
};

export function errorText(code: string, tr: ReturnType<typeof useT>): string {
  return tr(ERRORS[code] ?? 'errUnknown');
}

/** Account box at the top of the profile. */
export function AccountCard({ onOpen }: { onOpen: () => void }) {
  const tr = useT();
  const account = useStore((s) => s.account);
  if (!accountsEnabled) {
    return (
      <div className="account-card">
        <Icon name="user" size={22} />
        <p>{tr('accountSoon')}</p>
      </div>
    );
  }
  if (!account) {
    return (
      <div className="account-card">
        <Icon name="user" size={22} />
        <div>
          <p>{tr('accountPitch')}</p>
          <button className="btn" onClick={onOpen}>
            {tr('signIn')} / {tr('signUp')}
          </button>
        </div>
      </div>
    );
  }
  return (
    <button className="account-card signed-in" onClick={onOpen}>
      <span className="avatar">{(account.name || account.email).slice(0, 1).toUpperCase()}</span>
      <span className="account-text">
        <b>
          {tr('hello')} {account.name || account.email}
        </b>
        <SyncLine />
      </span>
      <Icon name="chevron" size={18} />
    </button>
  );
}

function SyncLine() {
  const tr = useT();
  const sync = useStore((s) => s.sync);
  const label = sync.state === 'syncing' ? tr('syncing') : sync.state === 'error' ? tr('syncError') : tr('syncOk');
  const time = sync.at ? new Date(sync.at).toLocaleTimeString(tr.lang, { hour: '2-digit', minute: '2-digit' }) : '';
  return (
    <small className={`sync ${sync.state}`}>
      <i />
      {label}
      {sync.state === 'ok' && time ? ` · ${time}` : ''}
    </small>
  );
}

type Mode = 'signin' | 'signup' | 'reset';

export function AccountSheet({ onClose, onToast }: { onClose: () => void; onToast: (t: string) => void }) {
  const tr = useT();
  const account = useStore((s) => s.account);
  return <Sheet title={tr('account')} onClose={onClose}>{account ? <SignedIn onClose={onClose} onToast={onToast} /> : <AuthForm />}</Sheet>;
}

function AuthForm() {
  const tr = useT();
  const [mode, setMode] = useState<Mode>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const switchTo = (m: Mode) => {
    setMode(m);
    setError(null);
    setNote(null);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setNote(null);
    if (mode === 'signup' && !cleanName(name)) return setError(tr('errName'));
    setBusy(true);
    try {
      if (mode === 'signup') await signUp(name, email, password);
      else if (mode === 'signin') await signIn(email, password);
      else {
        await resetPassword(email).catch((err) => {
          // Don't reveal whether an address has an account.
          if (errorCode(err) !== 'user-not-found') throw err;
        });
        setNote(tr('resetSent'));
      }
    } catch (err) {
      setError(errorText(errorCode(err), tr));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="auth" onSubmit={(e) => void submit(e)}>
      <h3>{mode === 'signup' ? tr('signUp') : mode === 'reset' ? tr('forgotPassword') : tr('signIn')}</h3>
      {mode !== 'reset' && <p className="hint">{tr('accountPitch')}</p>}
      {mode === 'signup' && (
        <label>
          <span>{tr('name')}</span>
          <input className="field" value={name} maxLength={NAME_MAX} autoComplete="nickname" onChange={(e) => setName(e.target.value)} required />
          <small>{tr('nameHint')}</small>
        </label>
      )}
      <label>
        <span>{tr('email')}</span>
        <input
          className="field"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </label>
      {mode !== 'reset' && (
        <label>
          <span>{tr('password')}</span>
          <input
            className="field"
            type="password"
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            minLength={PASSWORD_MIN}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {mode === 'signup' && <small>{tr('passwordHint')}</small>}
        </label>
      )}
      {mode === 'signup' && <p className="hint">{tr('dataNote')}</p>}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {note && <p className="form-note">{note}</p>}
      <div className="btn-row">
        <button className="btn" type="submit" disabled={busy}>
          {mode === 'signup' ? tr('signUp') : mode === 'reset' ? tr('sendReset') : tr('signIn')}
        </button>
      </div>
      <div className="auth-links">
        {mode === 'signin' && (
          <>
            <button type="button" className="inline-link" onClick={() => switchTo('reset')}>
              {tr('forgotPassword')}
            </button>
            <button type="button" className="inline-link" onClick={() => switchTo('signup')}>
              {tr('noAccount')}
            </button>
          </>
        )}
        {mode === 'signup' && (
          <button type="button" className="inline-link" onClick={() => switchTo('signin')}>
            {tr('haveAccount')}
          </button>
        )}
        {mode === 'reset' && (
          <button type="button" className="inline-link" onClick={() => switchTo('signin')}>
            {tr('backToSignIn')}
          </button>
        )}
      </div>
    </form>
  );
}

function SignedIn({ onClose, onToast }: { onClose: () => void; onToast: (t: string) => void }) {
  const tr = useT();
  const account = useStore((s) => s.account)!;
  const [name, setName] = useState(account.name);
  // The name can arrive a moment after sign-up or sign-in.
  useEffect(() => setName(account.name), [account.name]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<void>, after?: () => void) => {
    setError(null);
    setBusy(true);
    try {
      await fn();
      after?.();
    } catch (err) {
      setError(errorText(errorCode(err), tr));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth">
      <div className="account-head">
        <span className="avatar big">{(account.name || account.email).slice(0, 1).toUpperCase()}</span>
        <div>
          <b>{account.name || account.email}</b>
          <small>{account.email}</small>
          <SyncLine />
        </div>
      </div>
      <div className="btn-row">
        <button className="btn ghost" disabled={busy} onClick={() => void run(push)}>
          {tr('syncNow')}
        </button>
      </div>

      <div className="section-label">{tr('rename')}</div>
      <div className="inline-form">
        <input className="field" value={name} maxLength={NAME_MAX} onChange={(e) => setName(e.target.value)} />
        <button
          className="btn"
          disabled={busy || !cleanName(name) || cleanName(name) === account.name}
          onClick={() => void run(() => renameAccount(name), () => onToast(tr('saved')))}
        >
          {tr('save2')}
        </button>
      </div>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <div className="btn-row" style={{ marginTop: 26 }}>
        <button
          className="btn ghost"
          disabled={busy}
          onClick={() => window.confirm(tr('signOutConfirm')) && void run(signOut, onClose)}
        >
          {tr('signOut')}
        </button>
      </div>
      <div className="btn-row">
        <button
          className="btn danger"
          disabled={busy}
          onClick={() => window.confirm(tr('deleteConfirm')) && void run(deleteAccount, onClose)}
        >
          {tr('deleteAccount')}
        </button>
      </div>
    </div>
  );
}
