export default function PrivacyPage() {
  return (
    <div className="container mx-auto max-w-4xl p-8">
      <h1 className="text-3xl font-bold mb-6">Privacy Policy</h1>

      <p className="mb-6 text-muted-foreground">
        Last updated: {new Date().toLocaleDateString()}
      </p>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-3">1. Information We Collect</h2>
        <p className="text-muted-foreground mb-2">QwikNotes collects and stores the following information:</p>
        <ul className="list-disc ml-6 text-muted-foreground space-y-1">
          <li>Email address (for account creation and authentication)</li>
          <li>Notes and content you create in the application</li>
          <li>Notion OAuth tokens (when you connect your Notion workspace)</li>
          <li>Usage data and analytics to improve our service</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-3">2. How We Use Your Information</h2>
        <p className="text-muted-foreground mb-2">We use your information to:</p>
        <ul className="list-disc ml-6 text-muted-foreground space-y-1">
          <li>Provide and maintain the QwikNotes service</li>
          <li>Enable features like AI-powered note assistance</li>
          <li>Connect to your Notion workspace when you authorize it</li>
          <li>Improve and optimize our service</li>
          <li>Communicate with you about your account</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-3">3. Notion Integration</h2>
        <p className="text-muted-foreground mb-2">When you connect your Notion workspace:</p>
        <ul className="list-disc ml-6 text-muted-foreground space-y-1">
          <li>We store an OAuth access token to interact with your Notion on your behalf</li>
          <li>We can only access pages and databases you explicitly share with the integration</li>
          <li>Your Notion data is never shared with third parties</li>
          <li>You can disconnect at any time from your account settings</li>
          <li>Disconnecting will immediately delete your Notion token from our database</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-3">4. Data Storage and Security</h2>
        <p className="text-muted-foreground">
          Your data is stored securely in our database. We implement industry-standard
          security measures to protect your information. However, no method of transmission
          over the internet is 100% secure, and we cannot guarantee absolute security.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-3">5. Data Sharing</h2>
        <p className="text-muted-foreground mb-2">We do not sell, trade, or rent your personal information to third parties. We may share information only in these limited circumstances:</p>
        <ul className="list-disc ml-6 text-muted-foreground space-y-1">
          <li>With your explicit consent</li>
          <li>To comply with legal obligations</li>
          <li>To protect our rights and safety</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-3">6. Third-Party Services</h2>
        <p className="text-muted-foreground mb-2">We use the following third-party services:</p>
        <ul className="list-disc ml-6 text-muted-foreground space-y-1">
          <li>OpenAI API for AI-powered features</li>
          <li>Notion API when you connect your workspace</li>
          <li>Supabase for authentication</li>
        </ul>
        <p className="text-muted-foreground mt-2">
          Each service has its own privacy policy governing the use of your information.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-3">7. Your Rights</h2>
        <p className="text-muted-foreground mb-2">You have the right to:</p>
        <ul className="list-disc ml-6 text-muted-foreground space-y-1">
          <li>Access your personal data</li>
          <li>Correct inaccurate data</li>
          <li>Request deletion of your data</li>
          <li>Export your data</li>
          <li>Disconnect third-party integrations</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-3">8. Data Retention</h2>
        <p className="text-muted-foreground">
          We retain your data for as long as your account is active or as needed
          to provide services. If you delete your account, we will delete your
          personal information within 30 days, except where we are required to
          retain it for legal purposes.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-3">9. Children's Privacy</h2>
        <p className="text-muted-foreground">
          Our service is not intended for children under 13 years of age. We do
          not knowingly collect personal information from children under 13.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-3">10. Changes to This Policy</h2>
        <p className="text-muted-foreground">
          We may update this privacy policy from time to time. We will notify you
          of any changes by updating the "Last updated" date at the top of this policy.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-3">11. Contact Us</h2>
        <p className="text-muted-foreground">
          If you have any questions about this Privacy Policy or our data practices,
          please contact us.
        </p>
      </section>
    </div>
  );
}
