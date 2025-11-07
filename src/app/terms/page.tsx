export default function TermsPage() {
    return (
      <div className="container mx-auto max-w-4xl p-8">
        <h1 className="text-3xl font-bold mb-4">Terms of Use</h1>

        <p className="mb-4">Last updated: {new Date().toLocaleDateString()}</p>

        <section className="mb-6">
          <h2 className="text-2xl font-semibold mb-2">Acceptance of Terms</h2>
          <p>
            By using QwikNotes, you agree to these terms of use.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-2xl font-semibold mb-2">Use of Service</h2>
          <ul className="list-disc ml-6">
            <li>You must be 13 years or older to use this service</li>
            <li>You are responsible for your account security</li>
            <li>Do not use the service for illegal activities</li>
          </ul>
        </section>

        <section className="mb-6">
          <h2 className="text-2xl font-semibold mb-2">Notion Integration</h2>
          <p>
            When using the Notion integration, you grant QwikNotes permission to
            access Notion pages you've shared with the integration. You can revoke
            this access at any time.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-2xl font-semibold mb-2">Disclaimer</h2>
          <p>
            The service is provided "as is" without warranties of any kind.
          </p>
        </section>
      </div>
    );
  }