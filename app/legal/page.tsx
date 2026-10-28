import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, FileCheck2 } from 'lucide-react';
import {
  LegalIdentitySummary,
  LegalP,
  LegalSection,
} from '@/components/legal/LegalUI';
import {
  LEGAL_LAST_UPDATED,
  LEGAL_POLICY_VERSION,
  isLegalIdentityComplete,
} from '@/lib/legal';

export const metadata: Metadata = {
  title: 'Legal & policies',
  description:
    'The Terms of Service, Privacy Policy, refund rules, delivery terms and grievance contacts for CraveOS.',
};

const POLICIES = [
  {
    href: '/legal/terms',
    title: 'Terms of Service',
    body: 'The contract for your account, orders, memberships, payments and use of the site.',
  },
  {
    href: '/legal/privacy',
    title: 'Privacy Policy',
    body: 'What personal data we collect, why, who sees it, how long we keep it, and your rights.',
  },
  {
    href: '/legal/refunds',
    title: 'Refunds & cancellations',
    body: 'The cancellation window, refund methods and timelines, and how to report a problem.',
  },
  {
    href: '/legal/delivery',
    title: 'Delivery terms',
    body: 'Service areas, charges, time estimates, the delivery OTP handover and failed delivery.',
  },
  {
    href: '/legal/contact',
    title: 'Contact & grievance',
    body: 'How to reach support, what to include, and how to escalate to the grievance officer.',
  },
];

export default function LegalIndexPage() {
  const complete = isLegalIdentityComplete();

  return (
    <article className="space-y-10">
      <header className="space-y-3">
        <p className="text-xs font-black uppercase tracking-widest text-rose-600 dark:text-rose-400">
          Legal &amp; policies
        </p>
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
          The rules behind the food
        </h1>
        <p className="max-w-3xl text-sm leading-7 text-slate-600 dark:text-slate-300">
          These pages are the current contract between you and the operator of
          CraveOS. They are written to match what the product actually does: a
          server-verified quote, an order the kitchen can accept or reject, a
          cancellation window that closes when preparation starts, and refunds
          that return to the instrument that paid.
        </p>
        <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
          Policy version {LEGAL_POLICY_VERSION} · Last updated {LEGAL_LAST_UPDATED}
        </p>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {POLICIES.map((policy) => (
          <Link
            key={policy.href}
            href={policy.href}
            className="group rounded-2xl border border-slate-200 bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-rose-300 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900 dark:hover:border-rose-700"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1.5">
                <h2 className="text-sm font-black text-slate-900 dark:text-white">
                  {policy.title}
                </h2>
                <p className="text-xs leading-6 text-slate-500 dark:text-slate-400">
                  {policy.body}
                </p>
              </div>
              <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-rose-500" />
            </div>
          </Link>
        ))}
      </div>

      <LegalSection title="Operator identity">
        <LegalP>
          {complete
            ? 'Every legal identity field is configured. This build can pass the release gate.'
            : 'One or more legal identity fields are still placeholders. The release gate will block production until they are supplied; the banner at the top of this page lists what is missing.'}
        </LegalP>
        <LegalIdentitySummary />
      </LegalSection>

      <LegalSection title="Consent and policy versions">
        <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <FileCheck2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
          <p className="text-sm leading-7">
            New accounts must tick a box accepting the Terms of Service and
            Privacy Policy. The account stores the time of acceptance and the
            policy version shown, so support can tell which text applied. When a
            policy changes materially, the version is bumped and the new text is
            shown before the next acceptance.
          </p>
        </div>
      </LegalSection>
    </article>
  );
}
