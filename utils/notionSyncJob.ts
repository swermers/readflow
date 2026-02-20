import { createHash } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { decryptNotionToken } from '@/utils/notionCrypto';

type ProfileRow = {
  id: string;
  plan_tier: string | null;
  notion_access_token_enc: string | null;
};

type HighlightRow = {
  id: string;
  highlighted_text: string;
  note: string | null;
  auto_tags: string[] | null;
  notion_page_id: string | null;
  notion_source_hash: string | null;
  created_at: string;
  issues?: Array<{
    subject: string | null;
    from_email: string | null;
  }> | null;
};

function hashSource(input: { text: string; note: string | null; tags: string[]; subject: string | null }) {
  const canonical = JSON.stringify({
    text: input.text,
    note: input.note || '',
    tags: [...input.tags].sort(),
    subject: input.subject || '',
  });

  return createHash('sha256').update(canonical).digest('hex');
}

async function upsertNotionPage(token: string, highlight: HighlightRow) {
  const issueMeta = highlight.issues?.[0];
  const subject = issueMeta?.subject || 'Newsletter Highlight';
  const tags = highlight.auto_tags || [];

  const baseBody = {
    properties: {
      title: {
        title: [
          {
            type: 'text',
            text: { content: subject.slice(0, 200) },
          },
        ],
      },
    },
    children: [
      {
        object: 'block',
        type: 'quote',
        quote: {
          rich_text: [
            {
              type: 'text',
              text: { content: highlight.highlighted_text.slice(0, 1900) },
            },
          ],
        },
      },
      ...(highlight.note
        ? [
            {
              object: 'block',
              type: 'paragraph',
              paragraph: {
                rich_text: [
                  {
                    type: 'text',
                    text: { content: `Note: ${highlight.note.slice(0, 1800)}` },
                  },
                ],
              },
            },
          ]
        : []),
      ...(tags.length
        ? [
            {
              object: 'block',
              type: 'paragraph',
              paragraph: {
                rich_text: [
                  {
                    type: 'text',
                    text: { content: `Tags: ${tags.join(', ').slice(0, 1800)}` },
                  },
                ],
              },
            },
          ]
        : []),
    ],
  };

  if (highlight.notion_page_id) {
    const response = await fetch(`https://api.notion.com/v1/pages/${highlight.notion_page_id}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ properties: baseBody.properties }),
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(`Notion update failed: ${response.status} ${message.slice(0, 200)}`);
    }

    return highlight.notion_page_id;
  }

  const response = await fetch('https://api.notion.com/v1/pages', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      parent: { workspace: true },
      ...baseBody,
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Notion create failed: ${response.status} ${message.slice(0, 200)}`);
  }

  const created = (await response.json()) as { id?: string };
  if (!created.id) throw new Error('Notion create failed: missing page id');
  return created.id;
}

export async function processNotionSyncJob(supabase: SupabaseClient, userId: string) {
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, plan_tier, notion_access_token_enc')
    .eq('id', userId)
    .maybeSingle<ProfileRow>();

  if (profileError) throw profileError;
  if (!profile) throw new Error('Profile not found');
  if (profile.plan_tier !== 'elite') throw new Error('Notion sync requires elite tier');
  if (!profile.notion_access_token_enc) throw new Error('Notion is not connected');

  const notionToken = decryptNotionToken(profile.notion_access_token_enc);

  await supabase
    .from('profiles')
    .update({ notion_sync_status: 'syncing', notion_last_error: null })
    .eq('id', userId);

  const { data: highlights, error: highlightsError } = await supabase
    .from('highlights')
    .select('id, highlighted_text, note, auto_tags, notion_page_id, notion_source_hash, created_at, issues(subject, from_email)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100);

  if (highlightsError) throw highlightsError;

  let syncedCount = 0;
  for (const highlight of (highlights || []) as HighlightRow[]) {
    const sourceHash = hashSource({
      text: highlight.highlighted_text,
      note: highlight.note,
      tags: highlight.auto_tags || [],
      subject: highlight.issues?.[0]?.subject || null,
    });

    if (highlight.notion_source_hash && highlight.notion_source_hash === sourceHash) {
      continue;
    }

    try {
      const pageId = await upsertNotionPage(notionToken, highlight);
      await supabase
        .from('highlights')
        .update({
          notion_page_id: pageId,
          notion_source_hash: sourceHash,
          notion_last_synced_at: new Date().toISOString(),
          notion_sync_status: 'synced',
        })
        .eq('id', highlight.id)
        .eq('user_id', userId);
      syncedCount += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Notion sync failed';
      await supabase
        .from('highlights')
        .update({ notion_sync_status: 'error' })
        .eq('id', highlight.id)
        .eq('user_id', userId);
      throw new Error(`Highlight ${highlight.id} sync failed: ${message}`);
    }
  }

  await supabase
    .from('profiles')
    .update({
      notion_sync_status: 'ok',
      notion_last_synced_at: new Date().toISOString(),
      notion_last_error: null,
    })
    .eq('id', userId);

  return { syncedCount };
}
