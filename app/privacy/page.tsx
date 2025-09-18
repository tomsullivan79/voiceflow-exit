// app/privacy/page.tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | WildTriage",
  description:
    "Privacy policy for WildTriage. How we collect, use, and protect information for web chat and SMS.",
};

const Updated = () => (
  <p className="text-sm text-neutral-500 dark:text-neutral-400">
    Last updated:{" "}
    {new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })}
  </p>
);

export default function PrivacyPage() {
  return (
    <main className="min-h-[60vh] bg-neutral-50 dark:bg-neutral-950">
      <div className="mx-auto max-w-3xl px-6 sm:px-8 lg:px-10 py-10">
        <div className="rounded-2xl bg-white text-neutral-900 shadow-sm ring-1 ring-black/5 dark:bg-neutral-900 dark:text-neutral-100">
          <header className="px-6 sm:px-8 pt-8">
            <h1 className="text-3xl font-semibold tracking-tight">WildTriage — Privacy Policy</h1>
            <div className="mt-2">
              <Updated />
            </div>
          </header>

          <article className="px-6 sm:px-8 pb-10 pt-6 text-[15px] leading-7">
            <p className="mb-6 text-neutral-700 dark:text-neutral-300">
              This Privacy Policy explains how WildTriage (“we”, “us”, “our”) collects, uses, and protects
              information when you use our web chat and SMS services. By using the service, you agree to this
              policy.
            </p>

            <h2 className="mt-6 text-xl font-semibold">1) Information We Collect</h2>
            <ul className="mt-2 list-disc pl-6 space-y-2">
              <li>
                <strong>Contact &amp; case data:</strong> Messages you send (web/SMS), phone number (if you use
                SMS), and case details you provide.
              </li>
              <li>
                <strong>Technical data:</strong> IP address, timestamps, device/browser metadata, and delivery
                events from our messaging provider (e.g., Twilio).
              </li>
              <li>
                <strong>Optional media:</strong> Photos or files you choose to share for assessment.
              </li>
            </ul>

            <h2 className="mt-6 text-xl font-semibold">2) How We Use Information</h2>
            <ul className="mt-2 list-disc pl-6 space-y-2">
              <li>To provide triage guidance and maintain conversation history for continuity.</li>
              <li>To improve safety and quality via analytics, troubleshooting, and model refinement.</li>
              <li>To comply with legal obligations and prevent abuse or misuse.</li>
            </ul>

            <h2 className="mt-6 text-xl font-semibold">3) Sharing of Information</h2>
            <ul className="mt-2 list-disc pl-6 space-y-2">
              <li>
                <strong>Vendors:</strong> We use service providers (e.g., hosting, database, messaging) to operate
                the service. They process data on our behalf under contractual safeguards.
              </li>
              <li>
                <strong>Legal &amp; safety:</strong> We may disclose information if required by law, or if we
                believe it is necessary to protect people, wildlife, or property.
              </li>
            </ul>

            <h2 className="mt-6 text-xl font-semibold">4) Data Retention</h2>
            <p className="mt-2">
              We retain conversation data for as long as necessary for operations, quality improvement, and legal
              compliance. You may request deletion where applicable; some records may be kept as required by law.
            </p>

            <h2 className="mt-6 text-xl font-semibold">5) Security</h2>
            <p className="mt-2">
              We apply reasonable administrative, technical, and physical safeguards. No method of transmission or
              storage is 100% secure.
            </p>

            <h2 className="mt-6 text-xl font-semibold">6) Cookies &amp; Tracking</h2>
            <p className="mt-2">
              We may use cookies or similar technologies to maintain sessions and improve the service. You can
              manage cookie preferences in your browser settings.
            </p>

            <h2 className="mt-6 text-xl font-semibold">7) Children’s Privacy</h2>
            <p className="mt-2">
              The service is intended for users 18+. If you believe a minor has provided information, contact us
              to request deletion.
            </p>

            <h2 className="mt-6 text-xl font-semibold">8) Messaging (SMS) Disclosures</h2>
            <ul className="mt-2 list-disc pl-6 space-y-2">
              <li>Message frequency varies. Message &amp; data rates may apply.</li>
              <li>Reply <strong>STOP</strong> to opt out; reply <strong>HELP</strong> for help.</li>
              <li>
                Delivery events from our provider (e.g., Twilio) may be logged for reliability and fraud
                prevention.
              </li>
            </ul>

            <h2 className="mt-6 text-xl font-semibold">9) International Users</h2>
            <p className="mt-2">
              If you access the service from outside your country of residence, you consent to processing and
              storage in the regions where our service and vendors operate.
            </p>

            <h2 className="mt-6 text-xl font-semibold">10) Changes to this Policy</h2>
            <p className="mt-2">
              We may update this Privacy Policy from time to time. Material changes will be reflected by the “Last
              updated” date above.
            </p>

            <h2 className="mt-6 text-xl font-semibold">11) Contact</h2>
            <p className="mt-2">
              Questions or requests? Email{" "}
              <a className="underline underline-offset-4" href="mailto:support@wildtriage.org">
                support@wildtriage.org
              </a>
              .
            </p>
          </article>
        </div>
      </div>
    </main>
  );
}
