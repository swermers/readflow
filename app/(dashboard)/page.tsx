import { createClient } from '@/utils/supabase/server';
import Link from 'next/link';
import { ArrowUpRight, Clock } from 'lucide-react';
import SetupGuide from '@/components/SetupGuide';
import SyncButton from '@/components/SyncButton';
import AutoSync from '@/components/AutoSync';

export default async function Home() {
  const supabase = await createClient();

  const { data: emails, error } = await supabase
    .from('issues')
    .select('*, senders!inner(name, status)')
    .eq('senders.status', 'approved')
    .eq('status', 'unread')
    .order('received_at', { ascending: false });

  // Check if user has connected Gmail yet
  const { data: { user } } = await supabase.auth.getUser();
  let gmailConnected = false;
  let lastSyncAt: string | null = null;

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('gmail_connected, gmail_last_sync_at')
      .eq('id', user.id)
      .single();

    gmailConnected = profile?.gmail_connected || false;
    lastSyncAt = profile?.gmail_last_sync_at || null;
  }

  if (error) {
    console.error('Supabase error:', error);
    return (
      <div className="p-6 md:p-12 min-h-screen">
        <header className="mb-12">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-[#1A1A1A]">The Rack.</h1>
        </header>
        <div className="text-center py-20 bg-red-50 rounded-lg border border-red-100">
          <p className="text-gray-900 font-medium">Something went wrong loading your newsletters.</p>
          <p className="text-sm text-gray-500 mt-1">Please refresh the page to try again.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-12 min-h-screen">
      {/* Auto-sync in background when Gmail is connected */}
      {gmailConnected && <AutoSync lastSyncAt={lastSyncAt} />}

      <header className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-[#1A1A1A]">The Rack.</h1>
          <p className="text-sm text-gray-500 mt-1">{emails?.length || 0} issues waiting for you.</p>
        </div>
        {gmailConnected && (emails?.length ?? 0) > 0 && (
          <SyncButton variant="compact" />
        )}
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {emails?.map((email: any) => (
          <div
            key={email.id}
            className="group relative bg-white border border-gray-100 p-6 hover:border-[#FF4E4E] transition-colors h-64 flex flex-col justify-between shadow-sm hover:shadow-md"
          >
            <div className="flex justify-between items-start">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#FF4E4E]">
                {email.senders?.name || 'Unknown'}
              </span>
              <span className="text-[10px] text-gray-400 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {new Date(email.received_at).toLocaleDateString()}
              </span>
            </div>

            <div>
              <h3 className="text-lg font-bold leading-tight text-gray-900 mb-2 group-hover:text-[#FF4E4E] transition-colors">
                {email.subject}
              </h3>
              <p className="text-sm text-gray-500 line-clamp-3 leading-relaxed">{email.snippet}</p>
            </div>

            <div className="pt-4 border-t border-gray-50 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
              <Link
                href={`/newsletters/${email.id}`}
                className="flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-[#FF4E4E]"
              >
                Read <ArrowUpRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        ))}

        {(!emails || emails.length === 0) && (
          !gmailConnected ? (
            <SetupGuide gmailConnected={gmailConnected} />
          ) : (
            <div className="col-span-full py-12 text-center border-2 border-dashed border-gray-100 rounded-lg">
              <p className="mb-2 font-bold text-gray-900">All caught up.</p>
              <p className="text-xs text-gray-500 mb-6">
                No unread newsletters. Sync to check for new ones.
              </p>
              <div className="flex justify-center">
                <SyncButton />
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}
