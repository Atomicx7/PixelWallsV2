import React, { useCallback, useEffect, useState } from 'react';
import { DynamicBackground } from '../DynamicBackground';
import GlassSurface from '../GlassSurface';
import { useTheme } from '../../App';
import {
  adminFetch, getAdminSecret, setAdminSecret,
  AppClient, AdminUpload, AdminCategory, AdminAvatar,
} from './adminApi';

type Tab = 'overview' | 'apps' | 'uploads' | 'categories' | 'avatars';

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'apps', label: 'Apps' },
  { id: 'uploads', label: 'Uploads' },
  { id: 'categories', label: 'Categories' },
  { id: 'avatars', label: 'Avatars' },
];

const card = 'rounded-2xl border border-gray-200/60 dark:border-slate-700/60 bg-white/70 dark:bg-slate-900/70 p-5 shadow-sm';
const input =
  'w-full px-3 py-2 text-sm bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition';
const btn =
  'px-4 py-2 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-400 dark:disabled:bg-slate-700 disabled:cursor-not-allowed transition';
const btnGhost =
  'px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition';
const btnDanger =
  'px-3 py-1.5 text-xs font-semibold rounded-lg border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-500/10 transition';

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-3">{children}</h2>;
}

function Err({ message }: { message: string | null }) {
  if (!message) return null;
  return <p className="text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 mb-4">{message}</p>;
}

// ---------------------------------------------------------------- login ---
function AdminLogin({ onDone }: { onDone: () => void }) {
  const [secret, setSecret] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { theme } = useTheme();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      setAdminSecret(secret.trim());
      await adminFetch('/api/admin/stats');
      onDone();
    } catch (err: any) {
      setAdminSecret(null);
      setError(err.message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden">
      <DynamicBackground />
      <div className="relative z-10 w-full max-w-md p-4">
        <GlassSurface width="100%" height="auto" borderRadius={16} brightness={theme === 'dark' ? 15 : 90}
          backgroundOpacity={theme === 'dark' ? 0.15 : 0.5} blur={12} displace={3} saturation={1.3}
          className="shadow-2xl border border-gray-200/20 dark:border-slate-800/50">
          <form onSubmit={submit} className="p-8 space-y-6">
            <div className="text-center">
              <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">PixelWalls Admin</h1>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Enter the <code>ADMIN_SECRET</code> to manage apps, uploads & analytics.</p>
            </div>
            <Err message={error} />
            <input type="password" value={secret} onChange={(e) => setSecret(e.target.value)}
              placeholder="Admin secret" autoComplete="off" className={input} />
            <button type="submit" disabled={!secret.trim() || loading} className={`${btn} w-full`}>
              {loading ? 'Verifying…' : 'Open admin panel'}
            </button>
          </form>
        </GlassSurface>
      </div>
    </div>
  );
}

// ------------------------------------------------------------- overview ---
interface Stats {
  totals: { uploads: number; privateUploads: number; takenDown: number; users: number; premiumUsers: number; categories: number; avatars: number };
  apps: AppClient[];
  others: { source: string; uploads?: number; users?: number }[];
}

function StatCard({ value, label }: { value: React.ReactNode; label: string }) {
  return (
    <div className={card}>
      <p className="text-3xl font-black text-slate-900 dark:text-white">{value}</p>
      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{label}</p>
    </div>
  );
}

function OverviewTab({ refreshKey }: { refreshKey: number }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminFetch<Stats>('/api/admin/stats').then(setStats).catch((e: any) => setError(e.message));
  }, [refreshKey]);

  if (error) return <Err message={error} />;
  if (!stats) return <p className="text-sm text-slate-500">Loading analytics…</p>;
  const t = stats.totals;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard value={t.uploads} label="Total uploads" />
        <StatCard value={t.users} label="Total users" />
        <StatCard value={t.premiumUsers} label="Premium users" />
        <StatCard value={t.privateUploads} label="Private (app) uploads" />
        <StatCard value={stats.apps.filter((a) => a.isActive ?? a.is_active).length} label="Connected apps" />
        <StatCard value={t.takenDown} label="Taken down" />
        <StatCard value={t.categories} label="Categories" />
        <StatCard value={t.avatars} label="Active avatars" />
      </div>

      <div className={card}>
        <SectionTitle>Connected applications</SectionTitle>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 dark:text-slate-400 border-b border-gray-200 dark:border-slate-700">
                <th className="py-2 pr-4 font-semibold">App</th>
                <th className="py-2 pr-4 font-semibold">Users</th>
                <th className="py-2 pr-4 font-semibold">Premium</th>
                <th className="py-2 pr-4 font-semibold">Uploads</th>
                <th className="py-2 pr-4 font-semibold">Private</th>
                <th className="py-2 pr-4 font-semibold">Free quota/day</th>
                <th className="py-2 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {stats.apps.map((a) => (
                <tr key={a.client_id} className="border-b border-gray-100 dark:border-slate-800 last:border-0">
                  <td className="py-2 pr-4 font-semibold text-slate-800 dark:text-slate-200">{a.name}
                    <span className="block text-xs font-normal text-slate-400">{a.client_id}</span></td>
                  <td className="py-2 pr-4">{a.users ?? 0}</td>
                  <td className="py-2 pr-4">{a.premiumUsers ?? 0}</td>
                  <td className="py-2 pr-4">{a.uploads ?? 0}</td>
                  <td className="py-2 pr-4">{a.privateUploads ?? 0}</td>
                  <td className="py-2 pr-4">{a.freeUploadsPerDay ?? a.free_uploads_per_day ?? 0}</td>
                  <td className="py-2">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${(a.isActive ?? a.is_active) ? 'bg-green-500/15 text-green-600 dark:text-green-400' : 'bg-red-500/15 text-red-500'}`}>
                      {(a.isActive ?? a.is_active) ? 'ACTIVE' : 'REVOKED'}
                    </span>
                  </td>
                </tr>
              ))}
              {stats.apps.length === 0 && (
                <tr><td colSpan={7} className="py-4 text-slate-400">No apps yet — register one in the Apps tab.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {stats.others.length > 0 && (
        <div className={card}>
          <SectionTitle>Other origins</SectionTitle>
          {stats.others.map((o) => (
            <p key={o.source} className="text-sm text-slate-600 dark:text-slate-300">
              <span className="font-semibold capitalize">{o.source}</span>: {o.users ?? 0} users · {o.uploads ?? 0} uploads
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------- apps ---
function AppsTab({ onChange }: { onChange: () => void }) {
  const [apps, setApps] = useState<AppClient[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [canPremium, setCanPremium] = useState(true);
  const [canUpload, setCanUpload] = useState(true);
  const [quota, setQuota] = useState('5');
  const [creating, setCreating] = useState(false);
  const [newCreds, setNewCreds] = useState<{ clientId: string; secret: string } | null>(null);

  const load = useCallback(() => {
    adminFetch<AppClient[]>('/api/admin/apps').then(setApps).catch((e: any) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      const data = await adminFetch<{ clientId: string; secret: string }>('/api/admin/apps', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), canGrantPremium: canPremium, canGrantUpload: canUpload, freeUploadsPerDay: Number(quota) || 0 }),
      });
      setNewCreds(data);
      setName('');
      load();
      onChange();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  };

  const update = async (id: string, patch: object) => {
    setError(null);
    try {
      await adminFetch(`/api/admin/apps/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
      load();
      onChange();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const revoke = async (id: string, appName: string) => {
    if (!window.confirm(`Revoke "${appName}"? All its access keys die instantly.`)) return;
    setError(null);
    try {
      await adminFetch(`/api/admin/apps/${id}/revoke`, { method: 'POST' });
      load();
      onChange();
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <div className="space-y-6">
      <Err message={error} />
      {newCreds && (
        <div className="rounded-2xl border border-amber-400/50 bg-amber-500/10 p-5">
          <p className="font-bold text-amber-700 dark:text-amber-300 mb-2">App registered — copy the secret NOW (it can never be shown again)</p>
          <p className="text-sm text-slate-700 dark:text-slate-200">Client ID: <code className="font-mono bg-black/5 dark:bg-white/10 px-1 rounded">{newCreds.clientId}</code></p>
          <p className="text-sm text-slate-700 dark:text-slate-200 mt-1">Secret: <code className="font-mono bg-black/5 dark:bg-white/10 px-1 rounded break-all">{newCreds.secret}</code></p>
          <button className={`${btnGhost} mt-3`} onClick={() => { void navigator.clipboard?.writeText(newCreds.secret); }}>Copy secret</button>
        </div>
      )}

      <div className={card}>
        <SectionTitle>Register new application</SectionTitle>
        <form onSubmit={create} className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="App name, e.g. OffRecord" className={input} required />
          <input value={quota} onChange={(e) => setQuota(e.target.value)} placeholder="Free uploads/day (0 = disabled)" type="number" min={0} className={input} />
          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <input type="checkbox" checked={canPremium} onChange={(e) => setCanPremium(e.target.checked)} /> Can grant premium
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <input type="checkbox" checked={canUpload} onChange={(e) => setCanUpload(e.target.checked)} /> Can grant upload
          </label>
          <button type="submit" disabled={!name.trim() || creating} className={`${btn} md:col-span-2`}>
            {creating ? 'Registering…' : 'Generate client ID + secret'}
          </button>
        </form>
      </div>

      <div className={card}>
        <SectionTitle>Registered apps</SectionTitle>
        <div className="space-y-3">
          {apps.map((a) => {
            const active = a.isActive ?? a.is_active ?? true;
            return (
              <div key={a.client_id} className="rounded-xl border border-gray-200 dark:border-slate-700 p-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <p className="font-bold text-slate-800 dark:text-slate-100">{a.name}
                    <span className="ml-2 text-xs font-normal text-slate-400">{a.client_id}</span></p>
                  {active
                    ? <button className={btnDanger} onClick={() => revoke(a.client_id, a.name)}>Revoke</button>
                    : <span className="text-xs font-bold text-red-500">REVOKED</span>}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3 text-sm">
                  <label className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                    Free uploads/day
                    <input type="number" min={0} defaultValue={a.freeUploadsPerDay ?? a.free_uploads_per_day ?? 0} key={`${a.client_id}-q`}
                      onBlur={(e) => update(a.client_id, { freeUploadsPerDay: Number(e.target.value) || 0 })}
                      className={`${input} w-24`} disabled={!active} />
                  </label>
                  <label className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                    <input type="checkbox" defaultChecked={a.canGrantPremium ?? a.can_grant_premium ?? true}
                      onChange={(e) => update(a.client_id, { canGrantPremium: e.target.checked })} disabled={!active} /> Grant premium
                  </label>
                  <label className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                    <input type="checkbox" defaultChecked={a.canGrantUpload ?? a.can_grant_upload ?? true}
                      onChange={(e) => update(a.client_id, { canGrantUpload: e.target.checked })} disabled={!active} /> Grant upload
                  </label>
                </div>
              </div>
            );
          })}
          {apps.length === 0 && <p className="text-sm text-slate-400">None yet.</p>}
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------- uploads ---
function UploadsTab() {
  const [items, setItems] = useState<AdminUpload[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState('');
  const [status, setStatus] = useState('');
  const [visibility, setVisibility] = useState('');

  const load = useCallback(() => {
    const q = new URLSearchParams();
    if (source) q.set('source', source);
    if (status) q.set('status', status);
    if (visibility) q.set('visibility', visibility);
    adminFetch<AdminUpload[]>(`/api/admin/uploads?${q.toString()}`).then(setItems).catch((e: any) => setError(e.message));
  }, [source, status, visibility]);
  useEffect(load, [load]);

  const act = async (id: string, action: 'takedown' | 'restore') => {
    setError(null);
    try {
      await adminFetch(`/api/admin/uploads/${id}/${action}`, { method: 'POST' });
      load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const recat = async (id: string, category: string) => {
    if (!category) return;
    setError(null);
    try {
      await adminFetch(`/api/admin/uploads/${id}`, { method: 'PATCH', body: JSON.stringify({ category }) });
      load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <div className="space-y-4">
      <Err message={error} />
      <div className={`${card} flex flex-wrap gap-3`}>
        <input value={source} onChange={(e) => setSource(e.target.value)} placeholder="Filter: author source (e.g. manual)" className={`${input} max-w-xs`} />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={`${input} max-w-[180px]`}>
          <option value="">Any status</option><option value="live">Live</option><option value="taken_down">Taken down</option>
        </select>
        <select value={visibility} onChange={(e) => setVisibility(e.target.value)} className={`${input} max-w-[180px]`}>
          <option value="">Any visibility</option><option value="public">Public</option><option value="private">Private</option>
        </select>
      </div>
      {items.map((u) => (
        <div key={u.id} className={`${card} flex gap-4 flex-wrap sm:flex-nowrap`}>
          <img src={u.url} alt={u.title} className="w-24 h-24 object-cover rounded-xl bg-gray-200 dark:bg-slate-800" loading="lazy" />
          <div className="flex-1 min-w-[200px]">
            <p className="font-bold text-slate-800 dark:text-slate-100">{u.title || '(untitled)'}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {u.provider} · {u.category} · by {u.authorSource}{u.status !== 'live' ? ` · ${u.status}` : ''}{u.visibility === 'private' ? ' · PRIVATE' : ''}
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              {u.status === 'live'
                ? <button className={btnDanger} onClick={() => act(u.id, 'takedown')}>Take down</button>
                : <button className={btnGhost} onClick={() => act(u.id, 'restore')}>Restore</button>}
              <input placeholder="Recategorize…" className={`${input} max-w-[160px]`} key={`${u.id}-c`}
                onBlur={(e) => recat(u.id, e.target.value.trim())} />
            </div>
          </div>
        </div>
      ))}
      {items.length === 0 && <p className="text-sm text-slate-400">No uploads match.</p>}
    </div>
  );
}

// ----------------------------------------------------------- categories ---
function CategoriesTab({ onChange }: { onChange: () => void }) {
  const [cats, setCats] = useState<AdminCategory[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');

  const load = useCallback(() => {
    adminFetch<AdminCategory[]>('/api/admin/categories').then(setCats).catch((e: any) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  const save = async (n: string, patch: object) => {
    setError(null);
    try {
      await adminFetch(`/api/admin/categories/${encodeURIComponent(n)}`, { method: 'PATCH', body: JSON.stringify(patch) });
      load();
      onChange();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await adminFetch('/api/admin/categories', { method: 'POST', body: JSON.stringify({ name: name.trim() }) });
      setName('');
      load();
      onChange();
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <div className="space-y-4">
      <Err message={error} />
      <div className={card}>
        <SectionTitle>New category</SectionTitle>
        <form onSubmit={create} className="flex gap-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Category name" className={input} required />
          <button type="submit" className={btn}>Add</button>
        </form>
      </div>
      <div className={card}>
        <SectionTitle>Categories</SectionTitle>
        <div className="space-y-3">
          {cats.map((c) => (
            <div key={c.name} className="flex items-center justify-between flex-wrap gap-3 rounded-xl border border-gray-200 dark:border-slate-700 p-3">
              <p className="font-bold text-slate-800 dark:text-slate-100">{c.name}</p>
              <div className="flex items-center gap-3">
                <select value={c.visibility} onChange={(e) => save(c.name, { visibility: e.target.value })} className={`${input} w-auto text-sm`}>
                  <option value="free">Free</option>
                  <option value="premium">Premium</option>
                  <option value="hidden">Hidden</option>
                </select>
                <label className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <input type="checkbox" checked={c.showInPicker ?? (c as any).showPicker ?? true}
                    onChange={(e) => save(c.name, { showInPicker: e.target.checked })} /> In picker
                </label>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------- avatars ---
function AvatarsTab() {
  const [avatars, setAvatars] = useState<AdminAvatar[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState('');

  const load = useCallback(() => {
    adminFetch<AdminAvatar[]>('/api/admin/avatars').then(setAvatars).catch((e: any) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await adminFetch('/api/admin/avatars', { method: 'POST', body: JSON.stringify({ url: url.trim(), sortOrder: avatars.length }) });
      setUrl('');
      load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const toggle = async (a: AdminAvatar) => {
    setError(null);
    try {
      await adminFetch(`/api/admin/avatars/${a.id}`, { method: 'PATCH', body: JSON.stringify({ isActive: !(a.isActive ?? true) }) });
      load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <div className="space-y-4">
      <Err message={error} />
      <div className={card}>
        <SectionTitle>Add new avatar</SectionTitle>
        <form onSubmit={add} className="flex gap-3">
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://… image URL" type="url" className={input} required />
          <button type="submit" className={btn}>Add</button>
        </form>
      </div>
      <div className={card}>
        <SectionTitle>Predefined avatars ({avatars.filter((a) => a.isActive ?? true).length} active)</SectionTitle>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {avatars.map((a) => {
            const active = a.isActive ?? true;
            return (
              <div key={a.id} className={`rounded-xl border p-3 text-center ${active ? 'border-gray-200 dark:border-slate-700' : 'border-red-300 dark:border-red-800 opacity-60'}`}>
                <img src={a.url} alt="Avatar" className="w-20 h-20 rounded-full object-cover mx-auto bg-gray-200 dark:bg-slate-800" loading="lazy" />
                <button className={`${active ? btnDanger : btnGhost} mt-3`} onClick={() => toggle(a)}>
                  {active ? 'Deactivate' : 'Activate'}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- shell ---
export const AdminPanel: React.FC = () => {
  const [authed, setAuthed] = useState<boolean>(() => !!getAdminSecret());
  const [tab, setTab] = useState<Tab>('overview');
  const [refreshKey, setRefreshKey] = useState(0);
  const bump = () => setRefreshKey((k) => k + 1);

  if (!authed) return <AdminLogin onDone={() => setAuthed(true)} />;

  const logout = () => {
    setAdminSecret(null);
    setAuthed(false);
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      <DynamicBackground />
      <div className="relative z-10 container mx-auto px-4 py-8 max-w-5xl">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
          <div>
            <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">PixelWalls Admin</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Apps · analytics · moderation · avatars</p>
          </div>
          <div className="flex gap-2">
            <a href="/" className={btnGhost}>← Gallery</a>
            <button onClick={logout} className={btnGhost}>Lock panel</button>
          </div>
        </div>

        <div className="flex gap-2 mb-6 flex-wrap">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition ${
                tab === t.id ? 'bg-blue-600 text-white' : 'bg-black/5 dark:bg-white/10 text-slate-600 dark:text-slate-300'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'overview' && <OverviewTab refreshKey={refreshKey} />}
        {tab === 'apps' && <AppsTab onChange={bump} />}
        {tab === 'uploads' && <UploadsTab />}
        {tab === 'categories' && <CategoriesTab onChange={bump} />}
        {tab === 'avatars' && <AvatarsTab />}
      </div>
    </div>
  );
};
