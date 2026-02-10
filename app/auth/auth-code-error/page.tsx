'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function ErrorMessage() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');

  return (
    <>
      <p className="text-lg text-gray-700 mb-6">
        {error ? (
          <span className="font-mono text-red-600 bg-red-50 p-1 rounded text-sm break-all">
            Error: {error}
          </span>
        ) : (
          "We encountered an unknown error while logging you in."
        )}
      </p>
      <p className="text-sm text-gray-500 mb-8">
        {error?.includes('PKCE') 
          ? "Your browser blocked the login cookie. Try opening this in a normal Chrome window (not Incognito)."
          : "This usually happens if the link expired or was already used."}
      </p>
    </>
  );
}

export default function AuthErrorPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white p-6 text-center">
      <div className="max-w-md">
        <h1 className="text-4xl font-bold mb-4 text-[#FF4E4E]">Oops!</h1>
        
        <Suspense fallback={<p>Loading error...</p>}>
            <ErrorMessage />
        </Suspense>

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