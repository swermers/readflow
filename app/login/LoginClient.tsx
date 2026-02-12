'use client';

export default function LoginClient() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white p-6">
      <div className="w-full max-w-sm text-center">
        <div className="inline-block h-1 w-8 bg-[#FF4E4E] mb-8"></div>
        <h1 className="text-2xl font-bold tracking-tight text-[#1A1A1A] mb-2">Readflow.</h1>
        <p className="text-gray-500 mb-8 text-sm">Your personal newsletter sanctuary.</p>

        <a
          href="/auth/google"
          className="w-full bg-white border border-gray-300 text-[#1A1A1A] font-medium text-sm p-3 rounded flex items-center justify-center gap-3 hover:bg-gray-50 transition-colors mb-6"
        >
          Continue with Google
        </a>

        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200"></div>
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-white px-2 text-gray-500 uppercase tracking-wider">Or with email</span>
          </div>
        </div>

        <div className="text-xs text-gray-400">Magic links are temporarily disabled while we upgrade.</div>
      </div>
    </div>
  );
}
