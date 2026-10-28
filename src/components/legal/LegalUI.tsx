import React from 'react';
import { AlertTriangle } from 'lucide-react';
import {
  isLegalPlaceholder,
  legalIdentity,
  missingLegalFields,
} from '@/lib/legal';

export function LegalSection({
  id,
  title,
  children,
}: {
  id?: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 space-y-3">
      <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
        {title}
      </h2>
      <div className="space-y-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
        {children}
      </div>
    </section>
  );
}

export function LegalP({ children }: { children: React.ReactNode }) {
  return <p>{children}</p>;
}

export function LegalList({ children }: { children: React.ReactNode }) {
  return <ul className="list-disc pl-5 space-y-2">{children}</ul>;
}

export function LegalDefinition({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[11rem_1fr] gap-1 sm:gap-4 py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
      <dt className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </dt>
      <dd className="text-sm text-slate-700 dark:text-slate-300 break-words">
        {children}
      </dd>
    </div>
  );
}

/** Renders a configured value, or a visibly marked placeholder. */
export function LegalValue({
  value,
  className = '',
}: {
  value: string;
  className?: string;
}) {
  if (isLegalPlaceholder(value)) {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 font-mono text-[11px] font-bold text-amber-900 dark:bg-amber-950/60 dark:text-amber-200 ${className}`}
        title="Placeholder — the release gate blocks launch until this is replaced"
      >
        {value}
      </span>
    );
  }

  return <span className={className}>{value}</span>;
}

export function LegalPlaceholderBanner() {
  const missing = missingLegalFields();
  if (missing.length === 0) return null;

  return (
    <div className="border-b border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
      <div className="mx-auto max-w-5xl px-4 py-4 sm:px-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div className="space-y-1">
            <p className="text-sm font-black">
              Pre-launch build: this policy is not ready to be relied on.
            </p>
            <p className="text-xs leading-6">
              The legal identity below still contains placeholders. The release
              gate blocks production until every value is supplied:{' '}
              <span className="font-semibold">
                {missing.map((field) => field.label).join(', ')}.
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function LegalIdentitySummary() {
  return (
    <dl className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <LegalDefinition label="Legal entity">
        <LegalValue value={legalIdentity.entityName} />
      </LegalDefinition>
      <LegalDefinition label="Registered address">
        <LegalValue value={legalIdentity.registeredAddress} />
      </LegalDefinition>
      <LegalDefinition label="Jurisdiction">
        <LegalValue value={legalIdentity.jurisdiction} />
      </LegalDefinition>
      <LegalDefinition label="FSSAI licence">
        <LegalValue value={legalIdentity.fssaiLicence} />
      </LegalDefinition>
      <LegalDefinition label="GSTIN">
        <LegalValue value={legalIdentity.gstin} />
      </LegalDefinition>
      <LegalDefinition label="Support email">
        <LegalValue value={legalIdentity.supportEmail} />
      </LegalDefinition>
      <LegalDefinition label="Support phone">
        <LegalValue value={legalIdentity.supportPhone} />
      </LegalDefinition>
      <LegalDefinition label="Grievance officer">
        <LegalValue value={legalIdentity.grievanceOfficerName} />
      </LegalDefinition>
      <LegalDefinition label="Grievance email">
        <LegalValue value={legalIdentity.grievanceOfficerEmail} />
      </LegalDefinition>
      <LegalDefinition label="Grievance phone">
        <LegalValue value={legalIdentity.grievanceOfficerPhone} />
      </LegalDefinition>
    </dl>
  );
}
