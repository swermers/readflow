import { createClient } from '@/utils/supabase/server';
import { cookies } from 'next/headers';

export default async function Dashboard() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  const allCookies = cookies().getAll();

  // Calculate what the cookie name SHOULD be based on the Env Var
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "MISSING";
  const projectRef = supabaseUrl.replace("https://", "").split(".")[0];
  const expectedCookieName = `sb-${projectRef}-auth-token`;

  const foundCookie = allCookies.find(c => c.name.startsWith(expectedCookieName));

  return (
    <div className="min-h-screen p-12 bg-gray-50 font-mono text-sm">
      <div className="max-w-3xl mx-auto bg-white p-8 rounded-xl shadow border border-gray-200">
        <h1 className="text-2xl font-bold mb-6 text-blue-600">🔍 Configuration Diagnostic</h1>
        
        <div className="space-y-6">
          <section>
            <h2 className="font-bold border-b pb-2 mb-2">1. Environment Setup</h2>
            <div className="grid grid-cols-[200px_1fr] gap-2">
              <span className="text-gray-500">Supabase URL:</span>
              <span className="break-all">{supabaseUrl}</span>
              
              <span className="text-gray-500">Project ID (Ref):</span>
              <span className="font-bold bg-yellow-100 px-1">{projectRef}</span>
            </div>
          </section>

          <section>
            <h2 className="font-bold border-b pb-2 mb-2">2. Cookie Search</h2>
            <div className="grid grid-cols-[200px_1fr] gap-2">
              <span className="text-gray-500">Looking for Cookie:</span>
              <span className="break-all">{expectedCookieName}</span>
              
              <span className="text-gray-500">Did we find it?</span>
              <span className={foundCookie ? "text-green-600 font-bold" : "text-red-600 font-bold"}>
                {foundCookie ? "YES ✅" : "NO ❌"}
              </span>
            </div>
          </section>

          <section>
            <h2 className="font-bold border-b pb-2 mb-2">3. Visible Cookies</h2>
            <div className="bg-gray-100 p-4 rounded overflow-auto max-h-40">
              {allCookies.length === 0 ? "No cookies found." : (
                <ul className="list-disc pl-4">
                  {allCookies.map(c => (
                    <li key={c.name}>
                      <span className="font-bold text-gray-700">{c.name}</span>
                      <span className="text-gray-400 text-xs ml-2">({c.value.substring(0, 10)}...)</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section>
            <h2 className="font-bold border-b pb-2 mb-2">4. Auth Result</h2>
             <div className="grid grid-cols-[200px_1fr] gap-2">
              <span className="text-gray-500">User Status:</span>
              <span className={user ? "text-green-600 font-bold" : "text-red-600 font-bold"}>
                {user ? "LOGGED IN" : "LOGGED OUT"}
              </span>
              {error && (
                <>
                  <span className="text-gray-500">Error:</span>
                  <span className="text-red-500">{error.message}</span>
                </>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}