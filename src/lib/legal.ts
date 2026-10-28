/**
 * Legal and support identity.
 *
 * These values are configuration, not copy. They are read from `NEXT_PUBLIC_*`
 * variables so the same values render on the server and in the browser.
 *
 * Until every field is supplied, each one renders as a visibly marked
 * placeholder and `isLegalIdentityComplete()` returns false. The release gate
 * (`scripts/check-legal-identity.mjs --require`) refuses to let a build ship
 * with placeholders, so a page that names an entity always names the real one.
 */

export const LEGAL_POLICY_VERSION = '2026-10-27';
export const LEGAL_LAST_UPDATED = '27 October 2026';

const PLACEHOLDERS = {
  entityName: '{{LEGAL_ENTITY_NAME}}',
  registeredAddress: '{{LEGAL_REGISTERED_ADDRESS}}',
  jurisdiction: '{{LEGAL_JURISDICTION}}',
  fssaiLicence: '{{LEGAL_FSSAI_LICENCE}}',
  gstin: '{{LEGAL_GSTIN}}',
  supportEmail: '{{SUPPORT_EMAIL}}',
  supportPhone: '{{SUPPORT_PHONE}}',
  grievanceOfficerName: '{{GRIEVANCE_OFFICER_NAME}}',
  grievanceOfficerEmail: '{{GRIEVANCE_OFFICER_EMAIL}}',
  grievanceOfficerPhone: '{{GRIEVANCE_OFFICER_PHONE}}',
} as const;

export type LegalIdentityKey = keyof typeof PLACEHOLDERS;

function configured(value: string | undefined, placeholder: string) {
  const clean = String(value || '').trim();
  return clean || placeholder;
}

export const legalIdentity = {
  entityName: configured(
    process.env.NEXT_PUBLIC_LEGAL_ENTITY_NAME,
    PLACEHOLDERS.entityName,
  ),
  registeredAddress: configured(
    process.env.NEXT_PUBLIC_LEGAL_REGISTERED_ADDRESS,
    PLACEHOLDERS.registeredAddress,
  ),
  jurisdiction: configured(
    process.env.NEXT_PUBLIC_LEGAL_JURISDICTION,
    PLACEHOLDERS.jurisdiction,
  ),
  fssaiLicence: configured(
    process.env.NEXT_PUBLIC_LEGAL_FSSAI_LICENCE,
    PLACEHOLDERS.fssaiLicence,
  ),
  gstin: configured(process.env.NEXT_PUBLIC_LEGAL_GSTIN, PLACEHOLDERS.gstin),
  supportEmail: configured(
    process.env.NEXT_PUBLIC_SUPPORT_EMAIL,
    PLACEHOLDERS.supportEmail,
  ),
  supportPhone: configured(
    process.env.NEXT_PUBLIC_SUPPORT_PHONE,
    PLACEHOLDERS.supportPhone,
  ),
  grievanceOfficerName: configured(
    process.env.NEXT_PUBLIC_GRIEVANCE_OFFICER_NAME,
    PLACEHOLDERS.grievanceOfficerName,
  ),
  grievanceOfficerEmail: configured(
    process.env.NEXT_PUBLIC_GRIEVANCE_OFFICER_EMAIL,
    PLACEHOLDERS.grievanceOfficerEmail,
  ),
  grievanceOfficerPhone: configured(
    process.env.NEXT_PUBLIC_GRIEVANCE_OFFICER_PHONE,
    PLACEHOLDERS.grievanceOfficerPhone,
  ),
};

export interface LegalFieldDefinition {
  key: LegalIdentityKey;
  env: string;
  label: string;
}

/**
 * The single source of truth for what the launch gate must find. The gate
 * script carries the same env names so it can run without a TypeScript build.
 */
export const LEGAL_FIELD_DEFINITIONS: LegalFieldDefinition[] = [
  {
    key: 'entityName',
    env: 'NEXT_PUBLIC_LEGAL_ENTITY_NAME',
    label: 'Registered entity name',
  },
  {
    key: 'registeredAddress',
    env: 'NEXT_PUBLIC_LEGAL_REGISTERED_ADDRESS',
    label: 'Registered address',
  },
  {
    key: 'jurisdiction',
    env: 'NEXT_PUBLIC_LEGAL_JURISDICTION',
    label: 'Governing-law jurisdiction',
  },
  {
    key: 'fssaiLicence',
    env: 'NEXT_PUBLIC_LEGAL_FSSAI_LICENCE',
    label: 'FSSAI licence number',
  },
  { key: 'gstin', env: 'NEXT_PUBLIC_LEGAL_GSTIN', label: 'GSTIN' },
  {
    key: 'supportEmail',
    env: 'NEXT_PUBLIC_SUPPORT_EMAIL',
    label: 'Customer support email',
  },
  {
    key: 'supportPhone',
    env: 'NEXT_PUBLIC_SUPPORT_PHONE',
    label: 'Customer support phone',
  },
  {
    key: 'grievanceOfficerName',
    env: 'NEXT_PUBLIC_GRIEVANCE_OFFICER_NAME',
    label: 'Grievance officer name',
  },
  {
    key: 'grievanceOfficerEmail',
    env: 'NEXT_PUBLIC_GRIEVANCE_OFFICER_EMAIL',
    label: 'Grievance officer email',
  },
  {
    key: 'grievanceOfficerPhone',
    env: 'NEXT_PUBLIC_GRIEVANCE_OFFICER_PHONE',
    label: 'Grievance officer phone',
  },
];

export function isLegalPlaceholder(value: string): boolean {
  return /^\{\{[A-Z0-9_]+\}\}$/.test(String(value || '').trim());
}

export function missingLegalFields(): LegalFieldDefinition[] {
  return LEGAL_FIELD_DEFINITIONS.filter((field) =>
    isLegalPlaceholder(legalIdentity[field.key]),
  );
}

export function isLegalIdentityComplete(): boolean {
  return missingLegalFields().length === 0;
}

/**
 * Values inside prose still need the same guard: an address that is a
 * placeholder must never be rendered as if it were a real one.
 */
export function legalValue(key: LegalIdentityKey): string {
  return legalIdentity[key];
}
