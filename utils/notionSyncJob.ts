import crypto from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { decryptNotionToken } from '@/utils/notionCrypto';

type HighlightForSync = {
  id: string;
  highlighted_text: string;
  note: string | null;
  auto_tags: string[] | null;
  created_at: string;
  notion_page_id: string | null;
  notion_source_hash: string | null;
  notion_last_synced_at: string | null;
  notion_sync_status: 'pending' | 'synced' | 'failed';
  issues?: {
    subject?: string;
    senders?: {
      name?: string;
      email?: string;
    };
  };
};

const NOTION_VERSION = '2022-06-28';

function buildSourceHash(item: HighlightForSync) {
  const sender = item.issues?.senders?.name || item.issues?.senders?.email || '';
  const subject = item.issues?.subject || '';
  const note = item.note || '';
  const tags = (item.auto_tags || []).join(',');
  const payload = [item.highlighted_text, note, tags, subject, sender].join('||');
  return crypto.createHash('sha256').update(payload).digest('hex');
}

function notionHeaders(accessToken: string) {
  return {
    Authorization: `Bearer ${accessToken}`,
    'Notion-Version': NOTION_VERSION,
    'Content-Type': 'application/json',
  };
}

async function upsertNotionPage(accessToken: string, item: HighlightForSync) {
  const sender = item.issues?.senders?.name || item.issues?.senders?.email || 'Unknown sender';
  const subject = item.issues?.subject || 'Readflow highlight';
  const title = `${subject} — ${sender}`.slice(0, 1800);

  const body = {
    parent: { type: 'workspace', workspace: true },
    properties: {
      title: {
        title: [{ type: 'text', text: { content: title } }],
      },
    },
    children: [
      {
        object: 'block',
        type: 'quote',
        quote: {
          rich_text: [{ type: 'text', text: { content: item.highlighted_text.slice(0, 1900) } }],
        },
      },
      ...(item.note?.trim()
        ? [
            {
              object: 'block',
              type: 'paragraph',
              paragraph: {
                rich_text: [{ type: 'text', text: { content: `Note: ${item.note.trim().slice(0, 1900)}` } }],
              },
            },
          ]
        : []),
      {
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [
            { type: 'text', text: { content: `Tags: ${(item.auto_tags || []).map((tag) => `#${tag}`).join(' ') || '(none)'}` } },
          ],
        },
      },
      {
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [{ type: 'text', text: { content: `Saved from ${subject} (${sender})` } }],
        },
      },
    ],
  };

  if (item.notion_page_id) {
    const updateRes = await fetch(`https://api.notion.com/v1/pages/${item.notion_page_id}`, {
      method: 'PATCH',
      headers: notionHeaders(accessToken),
      body: JSON.stringify({ properties: body.properties }),
    });

    if (updateRes.ok) {
      await fetch(`https://api.notion.com/v1/blocks/${item.notion_page_id}/children`, {
        method: 'PATCH',
        headers: notionHeaders(accessToken),
        body: JSON.stringify({ children: body.children }),
      });
      return item.notion_page_id;
    }
  }

  const createRes = await fetch('https://api.notion.com/v1/pages', {
    method: 'POST',
    headers: notionHeaders(accessToken),
    body: JSON.stringify(body),
  });

  const createJson = (await createRes.json().catch(() => null)) as { id?: string; message?: string } | null;
  if (!createRes.ok || !createJson?.id) {
    throw new Error(createJson?.message || 'Failed to create Notion page');
  }

  return createJson.id;
}

export async function processNotionSyncJob(supabase: SupabaseClient, userId: string) {
  await supabase
    .from('profiles')
    .update({ notion_sync_status: 'syncing', notion_last_sync_error: null })
    .eq('id', userId);

  const { data: profile } = await supabase
    .from('profiles')
    .select('notion_connected, notion_access_token_encrypted')
    .eq('id', userId)
    .maybeSingle<{ notion_connected: boolean; notion_access_token_encrypted: string | null }>();

  if (!profile?.notion_connected || !profile.notion_access_token_encrypted) {
    throw new Error('Notion is not connected');
  }

  const accessToken = decryptNotionToken(profile.notion_access_token_encrypted);

  const { data: highlights, error } = await supabase
    .from('highlights')
    .select('id, highlighted_text, note, auto_tags, created_at, notion_page_id, notion_source_hash, notion_last_synced_at, notion_sync_status, issues(subject, senders(name, email))')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .returns<HighlightForSync[]>();

  if (error) {
    throw error;
  }

  let synced = 0;
  const failed: string[] = [];

  for (const item of highlights || []) {
    const nextHash = buildSourceHash(item);

    if (item.notion_source_hash === nextHash && item.notion_last_synced_at && item.notion_sync_status === 'synced') {
      continue;
    }

    try {
      const notionPageId = await upsertNotionPage(accessToken, item);
      await supabase
        .from('highlights')
        .update({
          notion_page_id: notionPageId,
          notion_source_hash: nextHash,
          notion_sync_status: 'synced',
          notion_last_synced_at: new Date().toISOString(),
        })
        .eq('id', item.id)
        .eq('user_id', userId);
      synced += 1;
    } catch (syncError) {
      failed.push(item.id);
      const message = syncError instanceof Error ? syncError.message : 'Sync failed';
      await supabase
        .from('highlights')
        .update({ notion_sync_status: 'failed' })
        .eq('id', item.id)
        .eq('user_id', userId);

      await supabase
        .from('profiles')
        .update({ notion_last_sync_error: message.slice(0, 1000) })
        .eq('id', userId);
    }
  }

  await supabase
    .from('profiles')
    .update({
      notion_sync_status: failed.length > 0 ? 'failed' : 'idle',
      notion_last_sync_at: new Date().toISOString(),
    })
    .eq('id', userId);

  return {
    total: (highlights || []).length,
    synced,
    failed: failed.length,
  };
}
