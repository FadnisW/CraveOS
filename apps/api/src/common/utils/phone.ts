import { BadRequestException } from '@nestjs/common';

/**
 * Normalises an Indian mobile number to `+91XXXXXXXXXX`.
 *
 * Phone is a delivery contact, not a login identifier. Rejecting malformed
 * numbers at the boundary keeps the rider and support from receiving a number
 * that cannot be dialled. Returns `null` for an explicitly empty value so a
 * customer can remove a number they no longer want on their profile.
 */
export function normaliseIndianPhone(
  input: string | null | undefined,
): string | null {
  const raw = String(input ?? '').trim();
  if (!raw) return null;

  let national = raw.replace(/[\s()-]/g, '');
  if (national.startsWith('+91')) national = national.slice(3);
  else if (national.startsWith('91') && national.length === 12) {
    national = national.slice(2);
  }

  if (!/^[6-9]\d{9}$/.test(national)) {
    throw new BadRequestException(
      'Enter a valid 10-digit Indian mobile number for delivery contact',
    );
  }

  return `+91${national}`;
}
