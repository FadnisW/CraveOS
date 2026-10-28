import type { Metadata } from 'next';
import Link from 'next/link';
import {
  LegalList,
  LegalP,
  LegalSection,
} from '@/components/legal/LegalUI';
import { LEGAL_LAST_UPDATED, LEGAL_POLICY_VERSION } from '@/lib/legal';

export const metadata: Metadata = {
  title: 'Delivery terms',
  description:
    'Where CraveOS delivers, how fees and estimates work, how the delivery OTP handover works, and what happens if nobody can receive the order.',
};

export default function DeliveryPage() {
  return (
    <article className="space-y-10">
      <header className="space-y-3">
        <p className="text-xs font-black uppercase tracking-widest text-rose-600 dark:text-rose-400">
          Delivery terms
        </p>
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
          From the kitchen to your door
        </h1>
        <p className="max-w-3xl text-sm leading-7 text-slate-600 dark:text-slate-300">
          CraveOS delivers from two Bengaluru kitchens. This page explains the
          service area, the charges shown at checkout, the handover, and what
          happens when delivery cannot be completed.
        </p>
        <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
          Version {LEGAL_POLICY_VERSION} · Last updated {LEGAL_LAST_UPDATED}
        </p>
      </header>

      <div className="space-y-9">
        <LegalSection title="1. Where we deliver">
          <LegalP>
            We currently deliver from our HSR Layout and Indiranagar kitchens to
            addresses inside each kitchen&apos;s live service area. Serviceability
            is checked against the kitchen polygon when you enter an address; the
            checkout refuses an address that no live kitchen serves.
          </LegalP>
          <LegalP>
            If you are just outside the area, the checkout will say so rather
            than accept an order we cannot fulfil. We do not promise delivery
            times or coverage for addresses outside the checked area.
          </LegalP>
        </LegalSection>

        <LegalSection title="2. Charges">
          <LegalList>
            <li>
              The item total, member discount, coupon discount, delivery fee,
              packaging fee, GST and wallet credit are all calculated by the
              server and shown before payment.
            </li>
            <li>
              Delivery and packaging are free for active members, as described on
              the membership plan you bought.
            </li>
            <li>
              The amount shown at checkout is the amount you pay. If the quote
              changes because the cart changed, you will see the new quote before
              you confirm.
            </li>
          </LegalList>
        </LegalSection>

        <LegalSection title="3. Time estimates">
          <LegalP>
            Any delivery time shown is an estimate based on kitchen load and the
            straight-line distance between the kitchen and your address. Traffic,
            weather, order volume and preparation time can change it. It is not a
            guaranteed delivery time and we do not pay compensation for a missed
            estimate.
          </LegalP>
          <LegalP>
            You can follow the live status in the order screen. If the order is
            running late, contact support rather than the rider while the rider is
            on the road.
          </LegalP>
        </LegalSection>

        <LegalSection title="4. Handover and the delivery OTP">
          <LegalP>
            When the rider arrives, share the delivery OTP shown on your order
            screen. The OTP is the proof that the food reached you; do not share
            it before the rider is at your door. Riders and kitchen staff cannot
            see the OTP in their own screens.
          </LegalP>
          <LegalP>
            If someone else will receive the order, give them your phone and the
            OTP at the time of delivery. You remain responsible for the order
            once it is handed over against the OTP.
          </LegalP>
        </LegalSection>

        <LegalSection title="5. If we cannot reach you">
          <LegalP>
            The rider will try to contact the phone number on the order. If the
            number is wrong, unanswered, or nobody can receive the order, the
            rider may have to leave after a reasonable wait. Because the food has
            already been prepared, an order that cannot be handed over may not be
            refundable.
          </LegalP>
          <LegalP>
            If you realise the address or phone number is wrong before dispatch,
            contact support immediately. We cannot change an address after the
            rider has left the kitchen.
          </LegalP>
        </LegalSection>

        <LegalSection title="6. Damaged, missing or spoiled items">
          <LegalP>
            Check the order when it arrives. If something is missing, damaged or
            spoiled, contact support as soon as you notice and keep the item and
            packaging where possible. The{' '}
            <Link className="font-bold text-rose-600 underline dark:text-rose-400" href="/legal/refunds">
              refunds policy
            </Link>{' '}
            explains what we refund and how long it takes.
          </LegalP>
        </LegalSection>

        <LegalSection title="7. Rider and customer safety">
          <LegalP>
            Our riders are entitled to a safe working environment. Threats,
            abuse, or unsafe conditions at the delivery address may lead to the
            order being cancelled and the account being suspended. If you feel
            unsafe during a delivery, contact support or the local emergency
            services.
          </LegalP>
        </LegalSection>

        <LegalSection title="8. Questions">
          <LegalP>
            Delivery questions are handled by the same support team as orders.
            See the{' '}
            <Link className="font-bold text-rose-600 underline dark:text-rose-400" href="/legal/contact">
              contact page
            </Link>{' '}
            for email, phone and grievance details.
          </LegalP>
        </LegalSection>
      </div>
    </article>
  );
}
