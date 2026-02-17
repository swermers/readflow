import Link from 'next/link';

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-white text-black px-6 py-10 md:px-12">
      <div className="max-w-3xl space-y-8">
        <header className="space-y-4">
          <Link href="/landing" className="text-xs uppercase tracking-[0.2em] text-gray-500 hover:text-[#FF4E4E]">← Back to landing</Link>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">Terms of Service</h1>
          <p className="text-sm text-gray-500">Effective date: February 2026</p>
        </header>

        <section className="space-y-4 text-gray-700 leading-relaxed">
          <p>
            By using Readflow, you agree to use the service in accordance with applicable law and to maintain the security of your
            account credentials.
          </p>
          <p>
            You retain ownership of your newsletter content and highlights. Readflow provides tools to organize and manage your reading
            experience but does not claim ownership of your imported content.
          </p>
          <p>
            We may update features and these terms over time. Continued use of the service after updates indicates acceptance of the
            revised terms.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Contact</h2>
          <p className="text-gray-700">
            Contact details for terms and legal questions will be published here before public launch.
          </p>
        </section>
      </div>
    </main>
  );
}
