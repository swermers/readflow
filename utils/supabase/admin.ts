import { createClient } from '@supabase/supabase-js';

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    console.error('[createAdminClient] Missing env vars:', {
      hasUrl: !!url,
      hasServiceKey: !!serviceKey,
      serviceKeyLength: serviceKey?.length ?? 0,
    });
    throw new Error('Missing Supabase admin env configuration');
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
