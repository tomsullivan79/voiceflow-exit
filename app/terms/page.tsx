// app/terms/page.tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Use | WildTriage",
  description:
    "Terms of Use for WildTriage web chat and SMS services. Not for emergencies; see your local wildlife authority for urgent help.",
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

export default function TermsPage() {
  return (
    <main className="min-h-[60vh] bg-neutral-50 dark:bg-neutral-950">
      <div className="mx-auto max-w-3xl px-6 sm:px-8 lg:px-10 py-10">
        <div className="rounded-2xl bg-white text-neutral-900 shadow-sm ring-1 ring-black/5 dark:bg-neutral-900 dark:text-neutral-100">
          <header className="px-6 sm:px-8 pt-8">
            <h1 className="text-3xl font-semibold tracking-tight">WildTriage — Terms of Use</h1>
            <div className="mt-2">
              <Updated />
            </div>
          </header>

          <article className="px-6 sm:px-8 pb-10 pt-6 text-[15px] leading-7">
            <p className="mb-6 text-neutral-700 dark:text-neutral-300">
              WildTriage provides informational guidance for members of the public seeking help with wildlife
              triage questions. WildTriage is <strong>not</strong> an emergency service and does not provide
              veterinary, medical, or legal advice. If you have an emergency, contact your local wildlife
              rehabilitation center, animal control, or emergency services.
            </p>

            <h2 className="mt-6 text-xl font-semibold">1) Acceptance of Terms</h2>
            <p className="mt-2">
              By accessing or using WildTriage (including web chat, SMS, or any related services), you agree to
              these Terms of Use and any policies referenced herein. If you do not agree, do not use the service.
            </p>

            <h2 className="mt-6 text-xl font-semibold">2) Eligibility &amp; Appropriate Use</h2>
            <ul className="mt-2 list-disc pl-6 space-y-2">
              <li>You must be at least 18 years old to use WildTriage.</li>
              <li>Do not use the service to harass, threaten, or violate the rights of others.</li>
              <li>Do not submit unlawful content or attempt to compromise the system.</li>
            </ul>

            <h2 className="mt-6 text-xl font-semibold">3) Informational Only; No Professional Advice</h2>
            <p className="mt-2">
              Guidance is provided “as is” for educational purposes and may not reflect the laws, regulations, or
              best practices in your jurisdiction. You are responsible for complying with local, state, and federal
              wildlife laws. When in doubt, contact licensed wildlife professionals.
            </p>

            <h2 className="mt-6 text-xl font-semibold">4) No Emergency or Critical Response</h2>
            <p className="mt-2">
              WildTriage does not dispatch responders or provide real-time emergency services. If a person or
              animal is in immediate danger, call local authorities or licensed wildlife rehabilitators.
            </p>

            <h2 className="mt-6 text-xl font-semibold">5) User Content</h2>
            <p className="mt-2">
              You may provide text, images, or other information (“User Content”). You represent you have rights
              to share it and grant WildTriage a non-exclusive license to use it to operate and improve the
              service. Do not upload sensitive personal information you do not wish to share.
            </p>

            <h2 className="mt-6 text-xl font-semibold">6) Messaging (SMS) Terms</h2>
            <ul className="mt-2 list-disc pl-6 space-y-2">
              <li>Message frequency varies. Message &amp; data rates may apply.</li>
              <li>Reply <strong>STOP</strong> to opt out; reply <strong>HELP</strong> for help.</li>
              <li>
                By initiating a conversation or providing your phone number, you consent to receive messages
                related to your inquiry and ongoing case updates.
              </li>
            </ul>

            <h2 className="mt-6 text-xl font-semibold">7) Intellectual Property</h2>
            <p className="mt-2">
              The WildTriage name, branding, and software are owned by their respective rights holders. You may
              not copy, modify, or distribute the service or its content except as allowed by law.
            </p>

            <h2 className="mt-6 text-xl font-semibold">8) Disclaimer of Warranties</h2>
            <p className="mt-2">
              THE SERVICE IS PROVIDED “AS IS” WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING, BUT
              NOT LIMITED TO, FITNESS FOR A PARTICULAR PURPOSE AND NON-INFRINGEMENT.
            </p>

            <h2 className="mt-6 text-xl font-semibold">9) Limitation of Liability</h2>
            <p className="mt-2">
              To the maximum extent permitted by law, WildTriage and its contributors are not liable for any
              indirect, incidental, special, consequential, or exemplary damages arising from your use of the
              service.
            </p>

            <h2 className="mt-6 text-xl font-semibold">10) Changes to the Terms</h2>
            <p className="mt-2">
              We may update these Terms from time to time. Continued use after changes constitutes acceptance of
              the updated Terms.
            </p>

            <h2 className="mt-6 text-xl font-semibold">11) Contact</h2>
            <p className="mt-2">
              Questions? Email{" "}
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
