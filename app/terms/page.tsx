// app/terms/page.tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Use | WildTriage",
  description:
    "Terms of Use for WildTriage web chat and SMS services. Not for emergencies; see your local wildlife authority for urgent help.",
};

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-10 text-sm leading-6 text-gray-900">
      <h1 className="text-3xl font-semibold tracking-tight mb-6">WildTriage — Terms of Use</h1>

      <p className="text-gray-600 mb-8">
        Last updated: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
      </p>

      <section className="space-y-4">
        <p>
          WildTriage provides informational guidance for members of the public seeking help with wildlife
          triage questions. WildTriage is <strong>not</strong> an emergency service and does not provide
          veterinary, medical, or legal advice. If you have an emergency, contact your local wildlife
          rehabilitation center, animal control, or emergency services.
        </p>

        <h2 className="text-xl font-semibold mt-6">1) Acceptance of Terms</h2>
        <p>
          By accessing or using WildTriage (including web chat, SMS, or any related services), you agree to
          these Terms of Use and any policies referenced herein. If you do not agree, do not use the service.
        </p>

        <h2 className="text-xl font-semibold mt-6">2) Eligibility & Appropriate Use</h2>
        <ul className="list-disc pl-6 space-y-2">
          <li>You must be at least 18 years old to use WildTriage.</li>
          <li>Do not use the service to harass, threaten, or violate the rights of others.</li>
          <li>Do not submit unlawful content or attempt to compromise the system.</li>
        </ul>

        <h2 className="text-xl font-semibold mt-6">3) Informational Only; No Professional Advice</h2>
        <p>
          Guidance is provided “as is” for educational purposes and may not reflect the laws, regulations, or
          best practices in your jurisdiction. You are responsible for complying with local, state, and federal
          wildlife laws. When in doubt, contact licensed wildlife professionals.
        </p>

        <h2 className="text-xl font-semibold mt-6">4) No Emergency or Critical Response</h2>
        <p>
          WildTriage does not dispatch responders or provide real-time emergency services. If a person or
          animal is in immediate danger, call local authorities or licensed wildlife rehabilitators.
        </p>

        <h2 className="text-xl font-semibold mt-6">5) User Content</h2>
        <p>
          You may provide text, images, or other information (“User Content”). You represent you have rights
          to share it and grant WildTriage a non-exclusive license to use it to operate and improve the
          service. Do not upload sensitive personal information you do not wish to share.
        </p>

        <h2 className="text-xl font-semibold mt-6">6) Messaging (SMS) Terms</h2>
        <ul className="list-disc pl-6 space-y-2">
          <li>Message frequency varies. Message &amp; data rates may apply.</li>
          <li>Reply <strong>STOP</strong> to opt out; reply <strong>HELP</strong> for help.</li>
          <li>
            By initiating a conversation or providing your phone number, you consent to receive messages
            related to your inquiry and ongoing case updates.
          </li>
        </ul>

        <h2 className="text-xl font-semibold mt-6">7) Intellectual Property</h2>
        <p>
          The WildTriage name, branding, and software are owned by their respective rights holders. You may
          not copy, modify, or distribute the service or its content except as allowed by law.
        </p>

        <h2 className="text-xl font-semibold mt-6">8) Disclaimer of Warranties</h2>
        <p>
          THE SERVICE IS PROVIDED “AS IS” WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING, BUT
          NOT LIMITED TO, FITNESS FOR A PARTICULAR PURPOSE AND NON-INFRINGEMENT.
        </p>

        <h2 className="text-xl font-semibold mt-6">9) Limitation of Liability</h2>
        <p>
          To the maximum extent permitted by law, WildTriage and its contributors are not liable for any
          indirect, incidental, special, consequential, or exemplary damages arising from your use of the
          service.
        </p>

        <h2 className="text-xl font-semibold mt-6">10) Changes to the Terms</h2>
        <p>
          We may update these Terms from time to time. Continued use after changes constitutes acceptance of
          the updated Terms.
        </p>

        <h2 className="text-xl font-semibold mt-6">11) Contact</h2>
        <p>
          Questions? Email <a className="underline" href="mailto:support@wildtriage.org">support@wildtriage.org</a>.
        </p>
      </section>
    </main>
  );
}
