import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cachedClient: SupabaseClient | null = null;

export function getSupabaseConfigStatus() {
  const url = process.env.SUPABASE_URL?.trim() || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || '';
  const bucket = process.env.SUPABASE_STORAGE_BUCKET?.trim() || 'edna-datasets';
  const configured = Boolean(url && serviceKey);

  return {
    configured,
    url,
    bucket,
    message: configured
      ? 'Supabase PostgreSQL and Storage connected via server-side service role.'
      : 'Supabase credentials (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY) are not configured. Scientific files and tables run in local session preview until configured.',
  };
}

export function getSupabaseAdmin(): SupabaseClient | null {
  const status = getSupabaseConfigStatus();
  if (!status.configured) return null;

  if (!cachedClient) {
    cachedClient = createClient(status.url, process.env.SUPABASE_SERVICE_ROLE_KEY!.trim(), {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return cachedClient;
}
