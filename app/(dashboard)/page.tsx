import { createClient } from '@/utils/supabase/server';
import Link from 'next/link';
// import { redirect } from 'next/navigation'; // Commented out for debug

export default async function Dashboard() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 🛑 DEBUG: If no user, show this screen instead of redirecting 🛑
  if (!user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-8 text-center bg-gray-50">
        <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8 border border-red-100">
          <div className="text-5xl mb-4">🕵️‍♂️</div>
          <h1 className="text-2xl font-bold text-red-600 mb-2">Debug: No User Found</h1>
          <p className="text-gray-600 mb-6">
            The Middleware let you through, but the Page cannot find your session.
          </p>
          <div className="text-left text-sm bg-gray-100 p-4 rounded font-mono overflow-auto">
            <p className="font-bold text-gray-700 mb-2">Check Vercel Logs for:</p>
            <ul className="list-disc pl-4 space-y-1 text-gray-600">
              <li>"Cookie Found?"</li>
              <li>"User Authenticated?"</li>
              <li>"Auth Error"</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  // --- Normal Code Below (Only runs if user exists) ---

  const { data: issues } = await supabase
    .from('issues')
    .select('*, senders(name, email)')
    .eq('user_id', user.id) // This is now safe because we handled the null case above
    .eq('status', 'unread')
    .order('received_at', { ascending: false });

  return (
    <div className="max-w-4xl mx-auto p-6 md:p-12">
      <header className="mb-12">
        <h1 className="text-4xl font-extrabold tracking-tight text-gray-900">
          The Rack
        </h1>
        <p className="text-gray-500 mt-2 text-lg">
          {issues?.length
            ? `You have ${issues.length} unread newsletters.`
            : 'You are all caught up.'}
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
                    {/* @ts-ignore - Supabase types sometimes act up with joins */}
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
            <p className="text-gray-500 mt-2">
              Go read a book or touch some grass.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}