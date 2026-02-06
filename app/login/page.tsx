import { items } from '@/mockData'; // Just for the visual background, or we can use a clean color

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white p-6">
      <div className="w-full max-w-sm text-center">
        
        {/* Logo */}
        <div className="inline-block h-1 w-8 bg-[#FF4E4E] mb-8"></div>
        <h1 className="text-2xl font-bold tracking-tight text-[#1A1A1A] mb-2">Readflow.</h1>
        <p className="text-gray-500 mb-8 text-sm">
          Your personal newsletter sanctuary.
        </p>

        {/* Login Form */}
        <form className="flex flex-col gap-4">
          <button 
            formAction={/* We will add the Google Action here later */ undefined}
            className="flex items-center justify-center gap-3 w-full bg-white border border-gray-200 text-[#1A1A1A] font-bold p-3 rounded hover:bg-gray-50 hover:border-gray-300 transition-all text-sm"
          >
            {/* Google Icon SVG */}
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.11c-.22-.66-.35-1.36-.35-2.11s.13-1.45.35-2.11V7.05H2.18C.79 9.81 0 12.92 0 16c0 3.08.79 6.19 2.18 8.95l3.66-2.84z"
                fill="#FBBC05"
              />
              <path
                d="M12 4.63c1.61 0 3.06.56 4.21 1.64l3.15-3.15C17.45 1.09 14.97 0 12 0 7.7 0 3.99 2.47 2.18 7.05l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Continue with Google
          </button>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-gray-100" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-gray-400">Or with email</span>
            </div>
          </div>

          <div className="space-y-3">
             <input 
                type="email" 
                name="email" 
                placeholder="name@example.com"
                className="w-full bg-gray-50 border border-gray-100 p-3 rounded text-sm outline-none focus:border-[#FF4E4E] transition-colors"
                required
             />
             <button 
                formAction={/* We will add Email Action here later */ undefined}
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