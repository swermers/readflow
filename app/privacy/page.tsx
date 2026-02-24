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
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Information We Collect</h2>
          <ul className="list-disc pl-5 space-y-2 text-gray-700 leading-relaxed">
            <li><strong>Account information:</strong> Your email address and name, provided through Google OAuth when you sign in.</li>
            <li><strong>Gmail data:</strong> If you connect Gmail, Readflow accesses email messages from the Gmail labels you select using read-only OAuth tokens. This includes message subjects, sender information, dates, and message body content.</li>
            <li><strong>Usage data:</strong> Preferences such as selected labels, sender approvals, highlights, and notes you create within the app.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">How We Use Your Data</h2>
          <p className="text-gray-700 leading-relaxed">
            We use your data solely to provide and improve Readflow&apos;s core functionality: importing, displaying, and organizing your newsletters. We do not use your data for advertising, and we do not use your Google user data to train machine learning or artificial intelligence models.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Data Sharing, Transfer, and Disclosure</h2>
          <p className="text-gray-700 leading-relaxed">
            We do not sell, rent, or trade your personal data or Google user data to any third party. We share your data only in the following limited circumstances:
          </p>
          <ul className="list-disc pl-5 space-y-2 text-gray-700 leading-relaxed">
            <li><strong>Infrastructure providers:</strong> Your data is stored on Supabase (database and authentication) and Vercel (application hosting). These providers process data on our behalf and are contractually obligated to protect it.</li>
            <li><strong>Legal requirements:</strong> We may disclose data if required by law, legal process, or government request.</li>
            <li><strong>With your consent:</strong> We will not share your data with any other third party without your explicit consent.</li>
          </ul>
          <p className="text-gray-700 leading-relaxed">
            No other parties have access to your Google user data. We do not share Google user data with advertising services, data brokers, or information resellers.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Data Protection</h2>
          <p className="text-gray-700 leading-relaxed">
            We implement the following measures to protect your data, including sensitive data obtained from Google APIs:
          </p>
          <ul className="list-disc pl-5 space-y-2 text-gray-700 leading-relaxed">
            <li><strong>Encryption in transit:</strong> All data transmitted between your browser, our servers, and third-party services is encrypted using HTTPS/TLS.</li>
            <li><strong>Encryption at rest:</strong> Your data is stored in Supabase databases with encryption at rest enabled.</li>
            <li><strong>Access controls:</strong> OAuth tokens and sensitive credentials are stored server-side and are never exposed to client-side code. Database access is restricted using row-level security policies, ensuring users can only access their own data.</li>
            <li><strong>Minimal scope:</strong> Readflow requests only the <code className="bg-gray-100 px-1.5 py-0.5 text-sm rounded">gmail.readonly</code> scope from Google, the minimum permission needed to import your newsletters.</li>
            <li><strong>Token management:</strong> Google OAuth refresh tokens are stored securely server-side. Access tokens are short-lived and refreshed automatically.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Data Retention and Deletion</h2>
          <p className="text-gray-700 leading-relaxed">
            You can delete individual issues at any time from within the app. Deleted issues are removed from your library and excluded from future Gmail re-imports tied to the same message ID.
          </p>
          <p className="text-gray-700 leading-relaxed">
            You can delete your entire account from Settings. This permanently removes all your data, including your profile, synced newsletters, highlights, notes, and stored OAuth tokens. This action is irreversible.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Google API Services Disclosure</h2>
          <p className="text-gray-700 leading-relaxed">
            Readflow&apos;s use and transfer of information received from Google APIs adheres to the{' '}
            <a className="text-[#FF4E4E] underline" href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer">
              Google API Services User Data Policy
            </a>, including the Limited Use requirements.
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
