import { createClient } from '@/utils/supabase/server';
import { notFound } from 'next/navigation';
import BackNavButton from '@/components/BackNavButton';
import EbookReader from './EbookReader';

export default async function EbookPage({ params }: { params: { id: string } }) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return notFound();
  }

  const { data: ebook, error } = await supabase
    .from('ebooks')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single();

  if (error || !ebook) {
    return notFound();
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-surface md:relative md:inset-auto md:z-auto md:h-screen">
      {/* Top bar */}
      <div className="shrink-0 border-b border-line bg-surface/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 md:px-6">
          <BackNavButton
            label="Books"
            fallbackHref="/books"
            className="inline-flex shrink-0 items-center gap-2 text-label uppercase text-ink-faint hover:text-accent transition-colors"
            iconClassName="w-4 h-4"
          />
          <div className="min-w-0 flex-1 text-center">
            <h1 className="text-sm font-bold text-ink truncate">{ebook.title}</h1>
            {ebook.author && (
              <p className="text-[10px] text-ink-faint truncate">{ebook.author}</p>
            )}
          </div>
          <div className="w-16 shrink-0" /> {/* Spacer for centering */}
        </div>
      </div>

      {/* Reader */}
      <EbookReader ebook={ebook} />
    </div>
  );
}
