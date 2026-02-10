'use client';

import Link from 'next/link';

export default function AuthErrorPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white p-6 text-center">
      <div className="max-w-md">
        <h1 className="text-4xl font-bold mb-4 text-[#FF4E4E]">Oops!</h1>
        <p className="text-lg text-gray-700 mb-6">
          We encountered an error while logging you in.
        </p>
        <p className="text-sm text-gray-500 mb-8">
          This usually happens if the link expired or was already used.
        </p>
        <Link 
          href="/login"
          className="bg-[#1A1A1A] text-white font-bold uppercase tracking-widest text-xs py-4 px-8 rounded hover:bg-[#FF4E4E] transition-colors"
        >
          Try Again
        </Link>
      </div>
    </div>
  );
}