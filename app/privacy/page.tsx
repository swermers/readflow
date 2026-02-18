import BackNavButton from '@/components/BackNavButton';

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-white text-black px-6 py-10 md:px-12">
      <div className="max-w-3xl space-y-8">
        <header className="space-y-4">
          <BackNavButton label="Back to landing" fallbackHref="/landing" className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-gray-500 hover:text-[#FF4E4E]" iconClassName="h-3.5 w-3.5" />
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">Privacy Policy</h1>
          <p className="text-sm text-gray-500">Effective date: February 2026</p>
        </header>

        <section className="space-y-4 text-gray-700 leading-relaxed">
          <p>
            Readflow exists to help you read newsletters in a calm, organized environment. We only collect the information required
            to provide core functionality: account details, sender preferences, and newsletter content you choose to sync.
          </p>
          <p>
            If you connect Gmail, Readflow uses Google OAuth tokens strictly to import newsletters from labels you select. We do not
            sell your personal data and we do not use your private content for advertising.
          </p>
          <p>
            You can delete content at any time from within the app. Deleted issues are removed from your library and excluded from
            future Gmail re-imports tied to the same message ID.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Contact</h2>
          <p className="text-gray-700">
            Questions about this policy? Contact us at <a className="text-[#FF4E4E]" href="mailto:trail.notes.co@gmail.com">trail.notes.co@gmail.com</a>.
          </p>
        </section>
      </div>
    </main>
  );
}
