'use client';

import { Mail, ArrowRight, ExternalLink } from 'lucide-react';
import Link from 'next/link';

export default function SetupGuide() {
  return (
    <div className="col-span-full max-w-2xl mx-auto w-full">
      <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 md:p-12">

        {/* Header */}
        <div className="text-center mb-10">
          <div className="w-12 h-12 bg-[#FF4E4E] rounded-full flex items-center justify-center mx-auto mb-4">
            <Mail className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-[#1A1A1A] mb-2">Welcome to Readflow</h2>
          <p className="text-sm text-gray-500">Connect Gmail to start syncing your newsletters.</p>
        </div>

        {/* Steps */}
        <div className="space-y-8">

          {/* Step 1: Connect Gmail */}
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#1A1A1A] text-white flex items-center justify-center text-sm font-bold">
              1
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-[#1A1A1A] mb-1">Connect your Gmail account</h3>
              <p className="text-sm text-gray-500 mb-3">
                Grant read-only access to emails you label for Readflow.
              </p>
              <Link
                href="/settings"
                className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest bg-[#1A1A1A] text-white px-6 py-3 hover:bg-[#FF4E4E] transition-colors"
              >
                <Mail className="w-3 h-3" />
                Go to Settings
              </Link>
            </div>
          </div>

          {/* Step 2: Create Gmail Label */}
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#1A1A1A] text-white flex items-center justify-center text-sm font-bold">
              2
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-[#1A1A1A] mb-1">Create a Gmail label</h3>
              <p className="text-sm text-gray-500 mb-3">
                In Gmail, create a label called "Readflow" (or any name you prefer).
              </p>
              <a
                href="https://mail.google.com/mail/u/0/#settings/labels"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-[#FF4E4E] hover:underline"
              >
                Open Gmail Labels <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          {/* Step 3: Create Gmail Filter */}
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#1A1A1A] text-white flex items-center justify-center text-sm font-bold">
              3
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-[#1A1A1A] mb-1">Create a Gmail filter</h3>
              <p className="text-sm text-gray-500 mb-3">
                Auto-label your newsletter emails with the Readflow label.
              </p>

              <details className="group border border-gray-200">
                <summary className="flex items-center justify-between px-4 py-3 cursor-pointer text-sm font-medium text-[#1A1A1A] hover:bg-gray-50">
                  <span>Filter setup instructions</span>
                  <ArrowRight className="w-4 h-4 text-gray-400 group-open:rotate-90 transition-transform" />
                </summary>
                <div className="px-4 pb-4 text-sm text-gray-600 space-y-2">
                  <ol className="list-decimal list-inside space-y-1.5">
                    <li>Go to <a href="https://mail.google.com/mail/u/0/#settings/filters" target="_blank" rel="noopener noreferrer" className="text-[#FF4E4E] underline inline-flex items-center gap-0.5">Gmail Filters <ExternalLink className="w-3 h-3" /></a></li>
                    <li>Click "Create a new filter"</li>
                    <li>In the "From" field, enter your newsletter sender (e.g., <code className="bg-gray-100 px-1 text-xs">@substack.com</code>)</li>
                    <li>Click "Create filter"</li>
                    <li>Check "Apply the label" and select "Readflow"</li>
                    <li>Optionally check "Also apply filter to matching emails" to label existing newsletters</li>
                    <li>Click "Create filter"</li>
                  </ol>
                  <p className="text-xs text-gray-500 mt-2 italic">
                    Tip: You can create multiple filters for different newsletter senders.
                  </p>
                </div>
              </details>
            </div>
          </div>

          {/* Step 4: Sync */}
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#1A1A1A] text-white flex items-center justify-center text-sm font-bold">
              4
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-[#1A1A1A] mb-1">Sync your newsletters</h3>
              <p className="text-sm text-gray-500 mb-3">
                Go back to Settings and click "Sync Now" to import your newsletters.
              </p>
              <Link
                href="/settings"
                className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest bg-[#1A1A1A] text-white px-6 py-3 hover:bg-[#FF4E4E] transition-colors"
              >
                Go to Settings
              </Link>
            </div>
          </div>

        </div>

        {/* Footer note */}
        <div className="mt-10 pt-8 border-t border-gray-200 text-center">
          <p className="text-xs text-gray-400">
            New senders will appear in the <strong>Review</strong> page for your approval before their newsletters show up in The Rack.
          </p>
        </div>

      </div>
    </div>
  );
}
