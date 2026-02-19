import type { SupabaseClient } from '@supabase/supabase-js';

export async function processNotionSyncJob(supabase: SupabaseClient, userId: string) {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, plan_tier')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  if (!profile) throw new Error('Profile not found');
  if (profile.plan_tier !== 'elite') {
    throw new Error('Notion sync requires elite tier');
  }

  // Placeholder for Notion v1 worker logic. Keeping this explicit prevents silent success
  // when a queued notion.sync job is processed before OAuth/connect flow is configured.
  throw new Error('Notion sync is not configured in this deployment');
}
