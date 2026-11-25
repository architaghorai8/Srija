import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cachedClient: SupabaseClient | null = null;

export function getSupabaseStatus() {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  return {
    configured: Boolean(url && key),
    urlSet: Boolean(url),
    serviceKeySet: Boolean(key),
    bucket: process.env.SUPABASE_STORAGE_BUCKET?.trim() || 'edna-datasets',
  };
}

export function getSupabaseAdminClient(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return null;
  if (!cachedClient) {
    cachedClient = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cachedClient;
}

export async function syncDatasetToSupabase(payload: {
  dataset: Record<string, unknown>;
  job: Record<string, unknown>;
  results: Array<Record<string, unknown>>;
  metrics: Record<string, unknown>;
}): Promise<{ synced: boolean; reason?: string }> {
  const client = getSupabaseAdminClient();
  if (!client) {
    return { synced: false, reason: 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not configured' };
  }
  try {
    const { error: dsErr } = await client.from('datasets').upsert(payload.dataset);
    if (dsErr) return { synced: false, reason: dsErr.message };

    const { error: jobErr } = await client.from('analysis_jobs').upsert(payload.job);
    if (jobErr) return { synced: false, reason: jobErr.message };

    if (payload.results.length > 0) {
      const { error: resErr } = await client.from('taxonomic_results').upsert(payload.results);
      if (resErr) return { synced: false, reason: resErr.message };
    }

    const { error: metErr } = await client.from('biodiversity_metrics').upsert(payload.metrics);
    if (metErr) return { synced: false, reason: metErr.message };

    return { synced: true };
  } catch (err) {
    return { synced: false, reason: err instanceof Error ? err.message : 'Supabase sync failed' };
  }
}
