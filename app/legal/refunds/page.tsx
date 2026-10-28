import type { Metadata } from 'next';
import Link from 'next/link';
import {
  LegalDefinition,
  LegalList,
  LegalP,
  LegalSection,
  LegalValue,
} from '@/components/legal/LegalUI';
import { LEGAL_LAST_UPDATED, LEGAL_POLICY_VERSION, legalIdentity } from '@/lib/legal';

export const metadata: Metadata = {
  title: 'Refunds & cancellations',
  description:
    'When a CraveOS order can be cancelled, how refunds are paid, how long they take, and how to report a missing or spoiled item.',
};

export default function RefundsPage() {
  return (
    <article className="space-y-10">
      <header className="space-y-3">
        <p className="text-xs font-black uppercase tracking-widest text-rose-600 dark:text-rose-400">
          Refunds &amp; cancellations
        </p>
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
          Cancel before the kitchen starts. Report problems after delivery.
        </h1>
        <p className="max-w-3xl text-sm leading-7 text-slate-600 dark:text-slate-300">
          Food is perishable, so the cancellation window closes when a kitchen
          accepts the order and begins preparation. This page explains exactly
          where that line is, what we refund, and how long it takes.
        </p>
        <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
          Version {LEGAL_POLICY_VERSION} · Last updated {LEGAL_LAST_UPDATED}
        </p>
      </header>

      <div className="space-y-9">
        <LegalSection title="1. Cancelling before the kitchen accepts">
          <LegalP>
            You can cancel from the order screen while every kitchen ticket is
            still waiting to be accepted. If you paid, we refund the full amount
            you paid: the wallet portion returns to your wallet immediately and
            the UPI or card portion is sent back to the original payment method.
          </LegalP>
          <LegalP>
            If the order was paid partly from your wallet and partly by card or
            UPI, both parts are returned. A coupon used on the order is released
            back to your account and can be used again while it is still valid.
          </LegalP>
        </LegalSection>

        <LegalSection title="2. When cancellation closes">
          <LegalP>
            Cancellation is no longer available once any kitchen has accepted the
            order, or once a rider has been assigned. At that point ingredients
            may already be used and the food is being prepared for you.
          </LegalP>
          <LegalP>
            If something is wrong after that point — a missing item, a spoiled
            item, or an order that never arrives — contact support. We will
            investigate the kitchen and delivery records and refund the affected
            items where the claim is verified. We may ask for a photograph or
            for the item to be returned.
          </LegalP>
        </LegalSection>

        <LegalSection title="3. If the kitchen rejects the order">
          <LegalP>
            If every kitchen rejects the order, it is cancelled automatically and
            the full amount is refunded without you needing to ask. If only one
            brand in a multi-brand order is rejected, we refund that brand&apos;s
            items and the tax on them; the rest of the order continues.
          </LegalP>
        </LegalSection>

        <LegalSection title="4. How refunds are paid">
          <LegalList>
            <li>
              <strong>Wallet payments:</strong> credited to your CraveOS wallet
              as soon as the cancellation is confirmed. Wallet credit can be used
              on a future order or membership, but cannot be withdrawn as cash.
            </li>
            <li>
              <strong>UPI and card payments:</strong> sent back through Razorpay
              to the original payment method. Most banks show the credit within
              5–7 working days; some take longer. We will give you the refund
              reference if you ask.
            </li>
            <li>
              <strong>Mixed payments:</strong> the wallet portion returns to the
              wallet immediately and the gateway portion returns to the original
              instrument on the timeline above.
            </li>
          </LegalList>
          <LegalP>
            We do not refund to a different card, a different UPI ID, or another
            person&apos;s wallet. This protects both you and us from refund fraud.
          </LegalP>
        </LegalSection>

        <LegalSection title="5. Partial refunds">
          <LegalP>
            Where only part of an order is affected, we refund the price you paid
            for the affected items and the tax charged on them. Delivery and
            packaging charges are refunded when the whole order is affected; they
            are not usually refunded for a single missing item because the
            delivery still took place.
          </LegalP>
          <LegalP>
            Discounts are handled fairly: if a coupon reduced the order total, the
            refund is based on what you actually paid for the affected items, not
            the pre-discount menu price.
          </LegalP>
        </LegalSection>

        <LegalSection title="6. Memberships">
          <LegalP>
            Membership fees are prepaid and do not renew automatically. A
            duplicate charge, an unauthorised charge, or a charge made after you
            cancelled a purchase is refunded in full. Outside those cases, a
            membership fee is not refunded once the plan has started, and
            cancelling does not create a pro-rata refund for unused days. This
            does not affect any right you have under consumer law.
          </LegalP>
          <LegalP>
            If you bought a paid plan during a free trial, the paid plan started
            immediately and the remaining trial days ended at that point. The
            purchase screen states this before you confirm.
          </LegalP>
        </LegalSection>

        <LegalSection title="7. How to report a problem">
          <LegalP>
            Contact us as soon as you notice the problem and include:
          </LegalP>
          <LegalList>
            <li>the order number;</li>
            <li>which item or items are affected;</li>
            <li>a short description of what went wrong; and</li>
            <li>a photograph where it helps (for example a missing or spoiled item).</li>
          </LegalList>
          <dl className="pt-2">
            <LegalDefinition label="Support email">
              <LegalValue value={legalIdentity.supportEmail} />
            </LegalDefinition>
            <LegalDefinition label="Support phone">
              <LegalValue value={legalIdentity.supportPhone} />
            </LegalDefinition>
            <LegalDefinition label="Grievance officer">
              <LegalValue value={legalIdentity.grievanceOfficerName} />
            </LegalDefinition>
          </dl>
          <LegalP>
            Please contact us before raising a chargeback with your bank. A
            chargeback can take longer and may suspend the account while the
            payment is disputed; we can usually resolve the issue faster
            directly.
          </LegalP>
        </LegalSection>

        <LegalSection title="8. If you disagree with the outcome">
          <LegalP>
            Ask us to review the decision and explain what evidence was used. If
            you are still unhappy, escalate to the grievance officer at{' '}
            <LegalValue value={legalIdentity.grievanceOfficerEmail} />. We aim to
            acknowledge a complaint within 48 hours and resolve it within 30
            days. You keep the right to approach a consumer forum or commission.
          </LegalP>
          <LegalP>
            These rules form part of the{' '}
            <Link className="font-bold text-rose-600 underline dark:text-rose-400" href="/legal/terms">
              Terms of Service
            </Link>
            . The{' '}
            <Link className="font-bold text-rose-600 underline dark:text-rose-400" href="/legal/delivery">
              delivery terms
            </Link>{' '}
            explain what happens if we cannot hand the order over.
          </LegalP>
        </LegalSection>
      </div>
    </article>
  );
}
