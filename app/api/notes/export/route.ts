import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

type HighlightRow = {
  id: string;
  highlighted_text: string;
  note: string | null;
  auto_tags: string[];
  created_at: string;
  issues?: {
    id?: string;
    subject?: string;
    senders?: {
      name?: string;
      email?: string;
    };
  };
};

function formatNotionMarkdown(highlights: HighlightRow[]): string {
  const grouped = new Map<string, HighlightRow[]>();

  highlights.forEach((item) => {
    const key = item.issues?.id || item.id;
    const existing = grouped.get(key) || [];
    existing.push(item);
    grouped.set(key, existing);
  });

  const header = [
    '# Readflow Notes Export',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '> Import this Markdown file into Notion as a document.',
    '',
  ];

  const body: string[] = [];

  grouped.forEach((items: HighlightRow[]) => {
    const first = items[0];
    const sender = first.issues?.senders?.name || first.issues?.senders?.email || 'Unknown sender';
    const subject = first.issues?.subject || 'Untitled issue';

    body.push(`## ${subject}`);
    body.push(`**Sender:** ${sender}`);
    body.push('');

    items.forEach((entry: HighlightRow) => {
      body.push(`- **Highlight:** ${entry.highlighted_text.replace(/\n/g, ' ')}`);

      if (entry.note?.trim()) {
        body.push(`  - Note: ${entry.note.replace(/\n/g, ' ')}`);
      }

      if (entry.auto_tags?.length) {
        body.push(`  - Tags: ${entry.auto_tags.map((tag: string) => `#${tag}`).join(' ')}`);
      }

      body.push(`  - Saved: ${new Date(entry.created_at).toLocaleString()}`);
    });

    body.push('');
  });

  return [...header, ...body].join('\n');
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const format = searchParams.get('format') || 'notion_markdown';

  if (format !== 'notion_markdown') {
    return NextResponse.json({ error: 'Unsupported export format' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('highlights')
    .select('id, highlighted_text, note, auto_tags, created_at, issues(id, subject, senders(name, email))')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .returns<HighlightRow[]>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const markdown = formatNotionMarkdown(data || []);

  return new NextResponse(markdown, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': `attachment; filename="readflow-notes-${new Date().toISOString().slice(0, 10)}.md"`,
    },
  });
}
