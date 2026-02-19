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

type NotionProfile = {
  notion_connected: boolean;
  notion_access_token_encrypted: string | null;
};

type NotionPageResponse = {
  id?: string;
  message?: string;
};

type NotionBlockListResponse = {
  results?: Array<{ id: string }>;
  message?: string;
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

function compactText(input: string, max = 1900) {
  return input.replace(/\s+/g, ' ').trim().slice(0, max);
}

function buildPageTitle(item: HighlightForSync) {
  const sender = item.issues?.senders?.name || item.issues?.senders?.email || 'Unknown sender';
  const subject = item.issues?.subject || 'Readflow highlight';
  return compactText(`${subject} — ${sender}`, 1800);
}

function buildChildren(item: HighlightForSync) {
  const sender = item.issues?.senders?.name || item.issues?.senders?.email || 'Unknown sender';
  const subject = item.issues?.subject || 'Readflow highlight';
  const tags = (item.auto_tags || []).map((tag) => `#${tag}`).join(' ') || '(none)';

  return [
    {
      object: 'block',
      type: 'quote',
      quote: {
        rich_text: [{ type: 'text', text: { content: compactText(item.highlighted_text) } }],
      },
    },
    ...(item.note?.trim()
      ? [
          {
            object: 'block',
            type: 'paragraph',
            paragraph: {
              rich_text: [{ type: 'text', text: { content: compactText(`Note: ${item.note.trim()}`) } }],
            },
          },
        ]
      : []),
    {
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: [{ type: 'text', text: { content: compactText(`Tags: ${tags}`) } }],
      },
    },
    {
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: [
          {
            type: 'text',
            text: {
              content: compactText(`Saved from ${subject} (${sender}) on ${new Date(item.created_at).toISOString()}`),
            },
          },
        ],
      },
    },
  ];
}

async function notionRequest<T>(accessToken: string, url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      ...notionHeaders(accessToken),
      ...(init.headers || {}),
    },
  });

  const json = (await response.json().catch(() => null)) as { message?: string } | null;
  if (!response.ok) {
    throw new Error(json?.message || `Notion request failed (${response.status})`);
  }

  return (json || {}) as T;
}

async function createNotionPage(accessToken: string, item: HighlightForSync) {
  const body = {
    parent: { type: 'workspace', workspace: true },
    properties: {
      title: {
        title: [{ type: 'text', text: { content: buildPageTitle(item) } }],
      },
    },
    children: buildChildren(item),
  };

  const created = await notionRequest<NotionPageResponse>(accessToken, 'https://api.notion.com/v1/pages', {
    method: 'POST',
    body: JSON.stringify(body),
  });

  if (!created.id) {
    throw new Error(created.message || 'Failed to create Notion page');
  }

  return created.id;
}

async function replaceExistingPage(accessToken: string, pageId: string, item: HighlightForSync) {
  await notionRequest(accessToken, `https://api.notion.com/v1/pages/${pageId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      properties: {
        title: {
          title: [{ type: 'text', text: { content: buildPageTitle(item) } }],
        },
      },
    }),
  });

  const children = await notionRequest<NotionBlockListResponse>(
    accessToken,
    `https://api.notion.com/v1/blocks/${pageId}/children?page_size=100`,
    { method: 'GET' },
  );

  for (const block of children.results || []) {
    await notionRequest(accessToken, `https://api.notion.com/v1/blocks/${block.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ archived: true }),
    });
  }

  await notionRequest(accessToken, `https://api.notion.com/v1/blocks/${pageId}/children`, {
    method: 'PATCH',
    body: JSON.stringify({ children: buildChildren(item) }),
  });
}

async function upsertNotionPage(accessToken: string, item: HighlightForSync) {
  if (item.notion_page_id) {
    try {
      await replaceExistingPage(accessToken, item.notion_page_id, item);
      return item.notion_page_id;
    } catch {
      // fall through to create a new page if the referenced page no longer exists or cannot be updated
    }
  }

  return createNotionPage(accessToken, item);
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
    .maybeSingle<NotionProfile>();

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

  if (error) throw error;

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
          notion_last_sync_error: null,
        })
        .eq('id', item.id)
        .eq('user_id', userId);

      synced += 1;
    } catch (syncError) {
      failed.push(item.id);
      const message = syncError instanceof Error ? syncError.message : 'Sync failed';

      await supabase
        .from('highlights')
        .update({ notion_sync_status: 'failed', notion_last_sync_error: message.slice(0, 1000) })
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
