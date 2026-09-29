import { apiUrl } from '../../api';

const SECRET_KEY = 'pw_admin_secret';

export function getAdminSecret(): string | null {
  try {
    return sessionStorage.getItem(SECRET_KEY);
  } catch {
    return null;
  }
}

export function setAdminSecret(secret: string | null) {
  try {
    if (secret) sessionStorage.setItem(SECRET_KEY, secret);
    else sessionStorage.removeItem(SECRET_KEY);
  } catch {}
}

/** Fetch with x-admin-secret. Throws Error(message) on failure. */
export async function adminFetch<T = any>(path: string, init?: RequestInit): Promise<T> {
  const secret = getAdminSecret();
  const res = await fetch(apiUrl(path), {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}), 'x-admin-secret': secret || '' },
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 403) throw new Error('Wrong admin secret.');
  if (!res.ok) throw new Error(data.details || data.error || `Request failed (${res.status})`);
  return data as T;
}

/** Multipart upload with x-admin-secret (lets the browser set the boundary). */
export async function adminUpload<T = any>(path: string, form: FormData): Promise<T> {
  const secret = getAdminSecret();
  const res = await fetch(apiUrl(path), {
    method: 'POST',
    headers: { 'x-admin-secret': secret || '' },
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 403) throw new Error('Wrong admin secret.');
  if (!res.ok) throw new Error(data.details || data.error || `Request failed (${res.status})`);
  return data as T;
}

export interface AppClient {
  client_id: string;
  name: string;
  canGrantPremium?: boolean;
  can_grant_premium?: boolean;
  canGrantUpload?: boolean;
  can_grant_upload?: boolean;
  freeUploadsPerDay?: number;
  free_uploads_per_day?: number;
  isActive?: boolean;
  is_active?: boolean;
  uploads?: number;
  privateUploads?: number;
  takenDown?: number;
  users?: number;
  premiumUsers?: number;
}

export interface AdminUpload {
  id: string;
  provider: string;
  providerId: string;
  url: string;
  title: string;
  category: string;
  authorUserId: string | null;
  authorSource: string;
  visibility: string;
  pickerVisible: boolean;
  status: string;
  createdAt: string;
}

export interface AdminCategory {
  name: string;
  visibility: 'free' | 'premium' | 'hidden';
  showInPicker?: boolean;
  showPicker?: boolean;
}

export interface AdminAvatar {
  id: string;
  url: string;
  sortOrder?: number;
  isActive?: boolean;
}
