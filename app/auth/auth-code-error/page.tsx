'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function ErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  const isPkceError = error?.includes('PKCE') || errorDescription?.includes('code verifier');
  const isGmailScopeError =
    errorDescription?.includes('gmail') ||
    errorDescription?.includes('scope') ||
    error?.includes('access_denied');

  return (
    <div className="space-y-6">
      <div className="inline-block h-1 w-8 bg-[#FF4E4E] mb-2"></div>
      <h1 className="text-3xl font-bold tracking-tight text-[#1A1A1A]">Authentication Error</h1>

      <div className="bg-red-50 border border-red-100 p-4 rounded-lg">
        <p className="text-sm font-mono text-red-600 break-all">
          {errorDescription || error || "An unexpected error occurred during sign-in."}
        </p>
      </div>

      <div className="text-left text-sm text-gray-600 space-y-4 bg-gray-50 p-6 rounded-lg">
        <p className="font-semibold text-[#1A1A1A]">How to fix this:</p>
        <ul className="list-disc ml-5 space-y-2">
          {isPkceError ? (
            <>
              <li><strong>Check Incognito:</strong> If you are in private mode, try a standard window.</li>
              <li><strong>Browser Settings:</strong> Ensure &quot;Block all cookies&quot; is disabled.</li>
              <li><strong>Refresh:</strong> Sometimes a simple refresh of the login page clears the state.</li>
            </>
          ) : isGmailScopeError ? (
            <>
              <li><strong>Gmail API not enabled:</strong> Go to Google Cloud Console &rarr; APIs &amp; Services &rarr; Library, search for &quot;Gmail API&quot;, and enable it.</li>
              <li><strong>Missing scope:</strong> In your OAuth consent screen, add the scope <code className="bg-gray-200 px-1 text-xs">https://www.googleapis.com/auth/gmail.readonly</code> using &quot;Manually add scopes&quot;.</li>
              <li><strong>Access denied:</strong> You may have clicked &quot;Cancel&quot; on the Google consent screen. Try again and approve the permissions.</li>
            </>
          ) : (
            <>
              <li>Ensure the login link hasn&apos;t expired (they usually last 10-20 minutes).</li>
              <li>Make sure you are using the same device/browser where you started the login.</li>
            </>
          )}
        </ul>
      </div>

      <div className="pt-4 space-y-3">
        <Link
          href="/login"
          className="inline-block w-full bg-[#1A1A1A] text-white font-medium text-sm p-4 rounded hover:bg-[#FF4E4E] transition-colors shadow-sm text-center"
        >
          Return to Login
        </Link>
        <Link
          href="/settings"
          className="inline-block w-full border border-gray-300 text-[#1A1A1A] font-medium text-sm p-4 rounded hover:bg-gray-50 transition-colors text-center"
        >
          Back to Settings
        </Link>
      </div>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white p-6">
      <div className="w-full max-w-md text-center">
        <Suspense fallback={
          <div className="animate-pulse">
            <div className="h-1 w-8 bg-gray-200 mx-auto mb-8"></div>
            <div className="h-8 w-48 bg-gray-200 mx-auto mb-4"></div>
            <div className="h-24 w-full bg-gray-100 rounded-lg"></div>
          </div>
        }>
          <ErrorContent />
        </Suspense>
      </div>
    </div>
  );
}
