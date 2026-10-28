import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, FileText, ShieldCheck } from 'lucide-react';
import {
  LegalPlaceholderBanner,
  LegalValue,
} from '@/components/legal/LegalUI';
import {
  LEGAL_LAST_UPDATED,
  LEGAL_POLICY_VERSION,
  isLegalPlaceholder,
  legalIdentity,
} from '@/lib/legal';

export const metadata: Metadata = {
  title: {
    default: 'Legal & policies — CraveOS',
    template: '%s — CraveOS',
  },
  description:
    'Terms of Service, Privacy Policy, refund and cancellation rules, delivery terms and grievance contacts for CraveOS.',
  robots: {
    // A pre-launch policy full of placeholders must not be indexed as if it
    // were the real contract. The release gate replaces this once complete.
    index: false,
    follow: false,
  },
};

const LEGAL_LINKS = [
  { href: '/legal/terms', label: 'Terms of Service' },
  { href: '/legal/privacy', label: 'Privacy Policy' },
  { href: '/legal/refunds', label: 'Refunds & cancellations' },
  { href: '/legal/delivery', label: 'Delivery terms' },
  { href: '/legal/contact', label: 'Contact & grievance' },
];

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supportEmailHref = isLegalPlaceholder(legalIdentity.supportEmail)
    ? null
    : `mailto:${legalIdentity.supportEmail}`;
  const supportPhoneHref = isLegalPlaceholder(legalIdentity.supportPhone)
    ? null
    : `tel:${legalIdentity.supportPhone.replace(/[^+\d]/g, '')}`;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <LegalPlaceholderBanner />

      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 transition-colors hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to store
            </Link>
            <span className="hidden h-4 w-px bg-slate-200 dark:bg-slate-700 sm:block" />
            <Link href="/legal" className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-rose-600 to-rose-500 text-sm font-extrabold text-white">
                E
              </span>
              <span className="text-sm font-black tracking-tight">Legal & policies</span>
            </Link>
          </div>

          <nav className="flex flex-wrap gap-x-4 gap-y-2 text-[11px] font-bold text-slate-500 dark:text-slate-400">
            {LEGAL_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="transition-colors hover:text-rose-600 dark:hover:text-rose-400"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">{children}</main>

      <footer className="border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-8 px-4 py-10 sm:px-6 md:grid-cols-3">
          <div className="space-y-2">
            <p className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-700 dark:text-slate-200">
              <ShieldCheck className="h-4 w-4 text-rose-500" />
              Operator
            </p>
            <p className="text-xs leading-6 text-slate-500 dark:text-slate-400">
              <LegalValue value={legalIdentity.entityName} />
              <br />
              <LegalValue value={legalIdentity.registeredAddress} />
            </p>
            <p className="text-[11px] leading-5 text-slate-500 dark:text-slate-400">
              FSSAI licence: <LegalValue value={legalIdentity.fssaiLicence} />
              <br />
              GSTIN: <LegalValue value={legalIdentity.gstin} />
            </p>
          </div>

          <div className="space-y-2">
            <p className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-700 dark:text-slate-200">
              <FileText className="h-4 w-4 text-rose-500" />
              Policies
            </p>
            <ul className="space-y-1.5 text-xs text-slate-500 dark:text-slate-400">
              {LEGAL_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="transition-colors hover:text-rose-600 dark:hover:text-rose-400"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-black uppercase tracking-widest text-slate-700 dark:text-slate-200">
              Support
            </p>
            <p className="text-xs leading-6 text-slate-500 dark:text-slate-400">
              {supportEmailHref ? (
                <a className="font-semibold hover:text-rose-600" href={supportEmailHref}>
                  {legalIdentity.supportEmail}
                </a>
              ) : (
                <LegalValue value={legalIdentity.supportEmail} />
              )}
              <br />
              {supportPhoneHref ? (
                <a className="font-semibold hover:text-rose-600" href={supportPhoneHref}>
                  {legalIdentity.supportPhone}
                </a>
              ) : (
                <LegalValue value={legalIdentity.supportPhone} />
              )}
            </p>
            <p className="text-[11px] leading-5 text-slate-500 dark:text-slate-400">
              Grievance officer: <LegalValue value={legalIdentity.grievanceOfficerName} />
            </p>
          </div>
        </div>

        <div className="border-t border-slate-100 px-4 py-5 text-center text-[11px] text-slate-500 dark:border-slate-800 dark:text-slate-400">
          Policy version {LEGAL_POLICY_VERSION} · Last updated {LEGAL_LAST_UPDATED} ·{' '}
          {new Date().getFullYear()} <LegalValue value={legalIdentity.entityName} />
        </div>
      </footer>
    </div>
  );
}
