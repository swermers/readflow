import { createClient } from '@/utils/supabase/server';
import Link from 'next/link';
import { ArrowLeft, Clock } from 'lucide-react';
import { notFound } from 'next/navigation';
import IssueActions from './IssueActions';
import HighlightableContent from '@/components/HighlightableContent';

export default async function NewsletterPage({ params }: { params: { id: string } }) {
  const supabase = await createClient();

  const { data: email, error } = await supabase
    .from('issues')
    .select('*, senders(*)')
    .eq('id', params.id)
    .single();

  if (error || !email) {
    return notFound();
  }

  // Auto-mark as read
  if (email.status === 'unread') {
    await supabase
      .from('issues')
      .update({ status: 'read', read_at: new Date().toISOString() })
      .eq('id', params.id);
  }

  return (
    <div className="min-h-screen">

      {/* ─── Top Bar ─── */}
      <div className="sticky top-0 z-10 bg-surface/80 backdrop-blur-md border-b border-line">
        <div className="max-w-reading mx-auto px-6 py-3 flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2 text-label uppercase text-ink-faint hover:text-accent transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>
          <span className="text-xs text-ink-faint flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            {new Date(email.received_at).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </span>
        </div>
      </div>

      {/* ─── Article ─── */}
      <article className="max-w-reading mx-auto px-6 md:px-8 py-12">

        {/* Sender */}
        <Link href={`/sender/${email.sender_id}`} className="group inline-flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-full bg-surface-overlay flex items-center justify-center text-lg font-bold text-ink-faint group-hover:bg-accent group-hover:text-white transition-colors">
            {email.senders?.name?.[0] || 'N'}
          </div>
          <div>
            <p className="text-sm font-bold text-ink group-hover:text-accent transition-colors">
              {email.senders?.name}
            </p>
            <p className="text-xs text-ink-faint">{email.senders?.email}</p>
          </div>
        </Link>

        {/* Title */}
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-ink leading-[1.15] mb-10">
          {email.subject}
        </h1>

        {/* Divider */}
        <div className="w-16 h-px bg-accent mb-10" />

        {/* Newsletter Content — with highlight + notes support */}
        <HighlightableContent issueId={email.id} bodyHtml={email.body_html} />

        {/* Footer Actions */}
        <IssueActions
          issueId={email.id}
          currentStatus={email.status}
          senderWebsite={email.senders?.website_url}
        />
      </article>
    </div>
  );
}
