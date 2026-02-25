import Link from "next/link";

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-black">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <Link href="/signup" className="text-orange-400 hover:text-orange-300 text-sm mb-6 inline-block">
          ← Back
        </Link>

        <h1 className="text-3xl font-bold text-stone-100 mb-8">Privacy Policy</h1>

        <div className="prose prose-invert prose-stone max-w-none space-y-6 text-stone-300 text-sm leading-relaxed">
          <p className="text-stone-400 text-xs">Last updated: February 2026</p>

          <section>
            <h2 className="text-lg font-semibold text-stone-100 mb-2">1. Information We Collect</h2>
            <p>When you create an account, we collect:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li><strong className="text-stone-200">Account information:</strong> email address, first name, last name, and tribe name.</li>
              <li><strong className="text-stone-200">Game data:</strong> your team selections, captain picks, transfer history, and scoring data.</li>
              <li><strong className="text-stone-200">Usage data:</strong> pages visited, features used, and session information.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-stone-100 mb-2">2. How We Use Your Information</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>To provide and maintain the Survivor Fantasy Team game experience.</li>
              <li>To display your tribe name and scores on league standings and the global leaderboard.</li>
              <li>To send game-related notifications (e.g., episode scoring updates, league invites).</li>
              <li>To improve the application and fix issues.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-stone-100 mb-2">3. Data Storage</h2>
            <p>Your data is stored securely using <strong className="text-stone-200">Supabase</strong> (powered by PostgreSQL), hosted on cloud infrastructure. We use industry-standard security practices including encryption in transit and at rest.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-stone-100 mb-2">4. Third-Party Services</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong className="text-stone-200">Supabase:</strong> authentication and database hosting.</li>
              <li><strong className="text-stone-200">Vercel:</strong> application hosting and serverless functions.</li>
              <li><strong className="text-stone-200">Google OAuth:</strong> optional sign-in provider (if you choose to sign in with Google).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-stone-100 mb-2">5. Cookies</h2>
            <p>We use essential cookies for authentication and session management. These are necessary for the application to function and cannot be disabled.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-stone-100 mb-2">6. Your Rights</h2>
            <p>You have the right to:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li><strong className="text-stone-200">Access:</strong> request a copy of the personal data we hold about you.</li>
              <li><strong className="text-stone-200">Deletion:</strong> request deletion of your account and associated data.</li>
              <li><strong className="text-stone-200">Correction:</strong> request correction of inaccurate information.</li>
              <li><strong className="text-stone-200">Portability:</strong> request your data in a machine-readable format.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-stone-100 mb-2">7. Data Sharing</h2>
            <p>We do not sell your personal data. Your tribe name, first name, last name, and scores are visible to other users via league standings and the global leaderboard. We do not share your email address with other users.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-stone-100 mb-2">8. Data Retention</h2>
            <p>We retain your data for as long as your account is active. If you delete your account, your personal data will be removed. Anonymized game data may be retained for analytical purposes.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-stone-100 mb-2">9. Changes to This Policy</h2>
            <p>We may update this Privacy Policy from time to time. We will notify you of significant changes via the application.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-stone-100 mb-2">10. Contact</h2>
            <p>For privacy-related questions or requests, please contact us through the application.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
