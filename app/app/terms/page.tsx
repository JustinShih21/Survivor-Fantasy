import Link from "next/link";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-black">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <Link href="/signup" className="text-orange-400 hover:text-orange-300 text-sm mb-6 inline-block">
          ← Back
        </Link>

        <h1 className="text-3xl font-bold text-stone-100 mb-8">Terms &amp; Conditions</h1>

        <div className="prose prose-invert prose-stone max-w-none space-y-6 text-stone-300 text-sm leading-relaxed">
          <p className="text-stone-400 text-xs">Last updated: February 2026</p>

          <section>
            <h2 className="text-lg font-semibold text-stone-100 mb-2">1. Acceptance of Terms</h2>
            <p>By creating an account and using Survivor Fantasy Team, you agree to be bound by these Terms &amp; Conditions. If you do not agree, do not use the application.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-stone-100 mb-2">2. Account Responsibilities</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>You must provide accurate information when creating your account.</li>
              <li>You are responsible for maintaining the security of your account credentials.</li>
              <li>You may only create one account per person.</li>
              <li>Your tribe name is permanent and cannot be changed after account creation.</li>
              <li>Tribe names must not contain offensive, vulgar, or inappropriate language.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-stone-100 mb-2">3. Game Rules</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Each user has one tribe (fantasy team) used across all leagues and the global leaderboard.</li>
              <li>Scoring rules are applied equally to all users and may be adjusted by administrators.</li>
              <li>Points are calculated automatically based on real Survivor episode events.</li>
              <li>Transfer rules, pricing, and budget constraints are enforced by the system.</li>
              <li>Once you join a league, you cannot leave it.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-stone-100 mb-2">4. Fair Play</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>You may not use bots, scripts, or automated tools to interact with the application.</li>
              <li>You may not exploit bugs or vulnerabilities. Please report them.</li>
              <li>You may not create multiple accounts to gain an unfair advantage.</li>
              <li>Violation of fair play rules may result in account suspension or termination.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-stone-100 mb-2">5. Intellectual Property</h2>
            <p>Survivor Fantasy Team is a fan-made fantasy game. &quot;Survivor&quot; is a registered trademark of CBS/Paramount. This application is not affiliated with, endorsed by, or sponsored by CBS, Paramount, or any related entity. Contestant images and names are used under fair use for non-commercial fan purposes.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-stone-100 mb-2">6. Limitation of Liability</h2>
            <p>The application is provided &quot;as is&quot; without warranty of any kind. We are not liable for any damages arising from your use of the application, including but not limited to data loss, service interruptions, or scoring errors.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-stone-100 mb-2">7. Account Termination</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>You may delete your account at any time. Deletion removes your tribe and league memberships.</li>
              <li>We reserve the right to suspend or terminate accounts that violate these terms.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-stone-100 mb-2">8. Modifications</h2>
            <p>We may modify these Terms &amp; Conditions at any time. Continued use of the application after changes constitutes acceptance of the modified terms. Significant changes will be communicated via the application.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-stone-100 mb-2">9. Governing Law</h2>
            <p>These terms are governed by applicable laws. Any disputes will be resolved through appropriate legal channels.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
