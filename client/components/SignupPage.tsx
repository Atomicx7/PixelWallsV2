import React, { useState } from 'react';
import { AuthShell, inputClass, submitClass } from './AuthShell';
import { User } from '../types';
import { apiUrl } from '../api';

interface SignupPageProps {
  onLogin: (user: User, token: string) => void;
  onSwitchToSignin: () => void;
}

/** Create-account page (new users). Creates the Neon-backed account and signs in. */
export const SignupPage: React.FC<SignupPageProps> = ({ onLogin, onSwitchToSignin }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const passwordsMatch = confirm.length === 0 || password === confirm;
  const valid =
    name.trim().length > 0 && email.includes('@') && password.length >= 8 && password === confirm;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(apiUrl('/api/auth/signup'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.details || data.error || `Request failed (${res.status})`);
      }
      if (!data?.token || !data?.user) throw new Error('Unexpected auth response.');
      onLogin(data.user as User, data.token as string);
    } catch (err: any) {
      setError(err.message || 'Account creation failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      subtitle="Create an account to start sharing wallpapers."
      footerText="Already have an account?"
      footerLink="Sign in"
      onFooterClick={onSwitchToSignin}
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <input
          id="name"
          name="name"
          type="text"
          autoComplete="name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Display name"
          className={inputClass}
        />
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email Address"
          className={inputClass}
        />
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password (min 8 characters)"
          className={inputClass}
        />
        <input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Confirm password"
          className={inputClass}
        />
        {!passwordsMatch && (
          <p className="text-sm text-amber-600 dark:text-amber-400">Passwords do not match.</p>
        )}
        {error && (
          <p className="text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
        )}
        <button type="submit" disabled={!valid || loading} className={submitClass}>
          {loading ? 'Creating account…' : 'Create account'}
        </button>
      </form>
    </AuthShell>
  );
};
