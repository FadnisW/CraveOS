import type { Metadata } from 'next';
import Link from 'next/link';
import {
  LegalDefinition,
  LegalIdentitySummary,
  LegalList,
  LegalP,
  LegalSection,
  LegalValue,
} from '@/components/legal/LegalUI';
import { LEGAL_LAST_UPDATED, LEGAL_POLICY_VERSION, legalIdentity } from '@/lib/legal';

export const metadata: Metadata = {
  title: 'Contact & grievance',
  description:
    'How to reach CraveOS support, how to escalate a complaint to the grievance officer, and the registered identity of the operator.',
};

export default function ContactPage() {
  return (
    <article className="space-y-10">
      <header className="space-y-3">
        <p className="text-xs font-black uppercase tracking-widest text-rose-600 dark:text-rose-400">
          Contact &amp; grievance
        </p>
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
          Reach a person, not a void
        </h1>
        <p className="max-w-3xl text-sm leading-7 text-slate-600 dark:text-slate-300">
          Order problems, refund questions and privacy requests all go to the
          same support team first. If we cannot resolve the issue, it can be
          escalated to the grievance officer.
        </p>
        <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
          Version {LEGAL_POLICY_VERSION} · Last updated {LEGAL_LAST_UPDATED}
        </p>
      </header>

      <LegalIdentitySummary />

      <div className="space-y-9">
        <LegalSection title="1. Customer support">
          <LegalP>
            Email is the best way to reach us because it keeps the order number
            and any photographs together. Include the order number in the subject
            line if your question is about a specific order.
          </LegalP>
          <dl>
            <LegalDefinition label="Email">
              <LegalValue value={legalIdentity.supportEmail} />
            </LegalDefinition>
            <LegalDefinition label="Phone">
              <LegalValue value={legalIdentity.supportPhone} />
            </LegalDefinition>
          </dl>
          <LegalP>
            We aim to acknowledge a support request within 48 hours and to
            resolve it within 30 days. A missing or spoiled item is usually
            resolved faster once we can see the order record.
          </LegalP>
        </LegalSection>

        <LegalSection title="2. What to include">
          <LegalList>
            <li>the order number, or the email address on your account;</li>
            <li>what happened and what outcome you are asking for;</li>
            <li>the date and time of the order or delivery; and</li>
            <li>photographs or screenshots that help explain the issue.</li>
          </LegalList>
          <LegalP>
            Do not send your card number, UPI PIN, one-time code, or password. We
            will never ask for them.
          </LegalP>
        </LegalSection>

        <LegalSection title="3. Grievance officer">
          <LegalP>
            If support has not resolved your complaint, or if it concerns how we
            handled your personal data, ask for the grievance officer. The
            officer is responsible for acknowledging the complaint and giving you
            a reasoned response.
          </LegalP>
          <dl>
            <LegalDefinition label="Name">
              <LegalValue value={legalIdentity.grievanceOfficerName} />
            </LegalDefinition>
            <LegalDefinition label="Email">
              <LegalValue value={legalIdentity.grievanceOfficerEmail} />
            </LegalDefinition>
            <LegalDefinition label="Phone">
              <LegalValue value={legalIdentity.grievanceOfficerPhone} />
            </LegalDefinition>
            <LegalDefinition label="Address">
              <LegalValue value={legalIdentity.registeredAddress} />
            </LegalDefinition>
          </dl>
          <LegalP>
            We acknowledge grievances within 48 hours and aim to resolve them
            within 30 days. If we need more time, we will explain why and give
            you a new date.
          </LegalP>
        </LegalSection>

        <LegalSection title="4. Privacy requests">
          <LegalP>
            To access, correct or delete your personal data, email the grievance
            officer from the address on your account. We may ask you to verify
            that you control the account before we act. Account data is deleted
            or anonymised within 30 days of a verified request; order, invoice,
            payment and tax records are kept for 8 years as required by law. If
            your wallet has credit, we will help you use or resolve it before
            the account is closed. The{' '}
            <Link className="font-bold text-rose-600 underline dark:text-rose-400" href="/legal/privacy">
              Privacy Policy
            </Link>{' '}
            explains this in full.
          </LegalP>
        </LegalSection>

        <LegalSection title="5. Other ways to resolve a dispute">
          <LegalP>
            Nothing on this page prevents you from approaching a consumer forum
            or commission, the Data Protection Board of India for a privacy
            complaint, or another authority that has jurisdiction. We ask only
            that you give us a chance to fix the issue first.
          </LegalP>
          <LegalP>
            The{' '}
            <Link className="font-bold text-rose-600 underline dark:text-rose-400" href="/legal/terms">
              Terms of Service
            </Link>{' '}
            set out the governing law and the jurisdiction for disputes.
          </LegalP>
        </LegalSection>
      </div>
    </article>
  );
}
