import { createClient } from '@/utils/supabase/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export default async function Dashboard() {
  // FIXED: Added 'await' here
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  //if (!user) {
  //  return redirect('/login');
 // }

  // Fetch ONLY unread issues for the "Rack"
  const { data: issues } = await supabase
    .from('issues')
    .select('*, senders(name, email)')
    .eq('user_id', user.id)
    .eq('status', 'unread')
    .order('received_at', { ascending: false });

  return (
    <div className="max-w-4xl mx-auto p-6 md:p-12">
      <header className="mb-12">
        <h1 className="text-4xl font-extrabold tracking-tight text-gray-900">The Rack</h1>
        <p className="text-gray-500 mt-2 text-lg">
          {issues?.length 
            ? `You have ${issues.length} unread newsletters.` 
            : "You are all caught up."}
        </p>
      </header>

      <div className="space-y-4">
        {issues?.map((issue) => (
          <Link 
            key={issue.id} 
            href={`/newsletters/${issue.id}`} 
            className="block group"
          >
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md hover:border-blue-300 transition-all cursor-pointer">
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">
                    {issue.senders?.name || issue.from_email}
                  </span>
                  <span className="text-gray-300">•</span>
                  <span className="text-xs text-gray-400">
                    {new Date(issue.received_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
              
              <h3 className="text-xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors mb-2">
                {issue.subject}
              </h3>
              
              <p className="text-gray-600 line-clamp-2 text-base leading-relaxed">
                {issue.snippet}
              </p>
            </div>
          </Link>
        ))}

        {issues?.length === 0 && (
          <div className="text-center py-24 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
            <div className="text-4xl mb-4">🎉</div>
            <h3 className="text-xl font-bold text-gray-900">Inbox Zero</h3>
            <p className="text-gray-500 mt-2">Go read a book or touch some grass.</p>
          </div>
        )}
      </div>
    </div>
  );
}