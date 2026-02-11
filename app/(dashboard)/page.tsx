import { createClient } from '@/utils/supabase/server';
import { cookies } from 'next/headers';

export default async function Dashboard() {
  const supabase = await createClient();
  
  // 1. Try to get the user
  const { data: { user }, error } = await supabase.auth.getUser();
  
  // 2. Look at the raw cookies
  const allCookies = cookies().getAll();

  return (
    <div className="p-12 space-y-6 max-w-2xl mx-auto font-mono text-sm bg-gray-50 min-h-screen">
      <h1 className="text-2xl font-bold text-red-600">🛑 Loop Breaker Debug 🛑</h1>
      
      <div className="bg-white p-6 shadow rounded">
        <h2 className="font-bold border-b pb-2 mb-4">1. Server Auth Status</h2>
        <p>User Found: <strong className={user ? "text-green-600" : "text-red-600"}>{user ? "YES" : "NO"}</strong></p>
        <p>Error: {error ? error.message : "None"}</p>
      </div>

      <div className="bg-white p-6 shadow rounded">
        <h2 className="font-bold border-b pb-2 mb-4">2. Raw Cookies Received by Server</h2>
        {allCookies.length === 0 ? "No cookies found." : (
          <ul className="list-disc pl-4 space-y-2 break-all">
            {allCookies.map(c => (
              <li key={c.name}>
                <span className="font-bold text-blue-600">{c.name}</span>
                <br/>
                <span className="text-gray-500 text-xs">Len: {c.value.length}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}