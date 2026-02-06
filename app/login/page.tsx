import { login } from './actions'; // Import the action we just made

export default function LoginPage({ searchParams }: { searchParams: { message: string } }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white p-6">
      <div className="w-full max-w-sm text-center">
        
        <div className="inline-block h-1 w-8 bg-[#FF4E4E] mb-8"></div>
        <h1 className="text-2xl font-bold tracking-tight text-[#1A1A1A] mb-2">Readflow.</h1>
        <p className="text-gray-500 mb-8 text-sm">
          Your personal newsletter sanctuary.
        </p>

        {/* Success/Error Message */}
        {searchParams?.message && (
          <div className="mb-6 p-3 bg-gray-50 text-xs text-center text-gray-600 border border-gray-100 rounded">
            {searchParams.message}
          </div>
        )}

        <form className="flex flex-col gap-4">
          {/* We are hiding Google for now to focus on the Magic Link */}
          
          <div className="space-y-3">
             <input 
                type="email" 
                name="email" 
                placeholder="name@example.com"
                className="w-full bg-gray-50 border border-gray-100 p-3 rounded text-sm outline-none focus:border-[#FF4E4E] transition-colors"
                required
             />
             {/* Connect the form action here */}
             <button 
                formAction={login} 
                className="w-full bg-[#1A1A1A] text-white font-bold uppercase tracking-widest text-xs p-4 rounded hover:bg-[#FF4E4E] transition-colors"
             >
                Send Magic Link
             </button>
          </div>
        </form>
      </div>
    </div>
  );
}