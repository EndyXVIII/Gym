/**
 * Supabase client, loaded only when the project is configured (VITE_SUPABASE_URL
 * and VITE_SUPABASE_ANON_KEY). Without them the app is local-only.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { NetworkError, type PushRow, type RemoteAdapter, type RemoteRow } from './sync';

const URL_ = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() || '';
const KEY = ((import.meta.env.VITE_SUPABASE_ANON_KEY ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) as string | undefined)?.trim() || '';

export const supabaseConfigured = !!URL_ && !!KEY;

let client: Promise<SupabaseClient> | null = null;

export function getSupabase(): Promise<SupabaseClient> {
  if (!supabaseConfigured) return Promise.reject(new Error('Supabase non configurato'));
  if (!client) {
    client = import('@supabase/supabase-js').then(({ createClient }) =>
      createClient(URL_, KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'scheda-auth' },
      }),
    );
  }
  return client;
}

/** True if a session was saved on this device (checked without loading the client). */
export function hasStoredSession(): boolean {
  try {
    return !!localStorage.getItem('scheda-auth');
  } catch {
    return false;
  }
}

function isNetworkError(e: unknown): boolean {
  const msg = String((e as { message?: string })?.message ?? e).toLowerCase();
  return (
    (typeof navigator !== 'undefined' && navigator.onLine === false) ||
    msg.includes('failed to fetch') ||
    msg.includes('network') ||
    msg.includes('load failed') ||
    msg.includes('fetch')
  );
}

function wrap(e: unknown): Error {
  if (isNetworkError(e)) return new NetworkError(String((e as Error)?.message ?? e));
  return e instanceof Error ? e : new Error(String((e as { message?: string })?.message ?? e));
}

export const BUCKET = 'media';

export async function supabaseAdapter(): Promise<RemoteAdapter> {
  const sb = await getSupabase();
  return {
    async userId() {
      const { data } = await sb.auth.getSession();
      return data.session?.user.id ?? null;
    },
    async push(table: string, rows: PushRow[]) {
      const { error } = await sb.from(table).upsert(rows, { onConflict: 'id', ignoreDuplicates: false, defaultToNull: false });
      if (error) throw wrap(error);
    },
    async pull(table: string, since: string | null, limit: number) {
      let q = sb.from(table).select('id,data,updated_at,deleted_at,server_updated_at').order('server_updated_at', { ascending: true }).limit(limit);
      if (since) q = q.gt('server_updated_at', since);
      const { data, error } = await q;
      if (error) throw wrap(error);
      return (data ?? []) as RemoteRow[];
    },
    async upload(path: string, blob: Blob, contentType: string) {
      const { error } = await sb.storage.from(BUCKET).upload(path, blob, { upsert: true, contentType, cacheControl: '31536000' });
      if (error) throw wrap(error);
    },
    async download(path: string) {
      const { data, error } = await sb.storage.from(BUCKET).download(path);
      if (error || !data) throw wrap(error ?? new Error('download failed'));
      return data;
    },
    async remove(path: string) {
      const { error } = await sb.storage.from(BUCKET).remove([path]);
      if (error) throw wrap(error);
    },
  };
}
