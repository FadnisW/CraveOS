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
  title: 'Terms of Service',
  description:
    'The terms that govern CraveOS accounts, orders, payments, memberships, cancellations and deliveries.',
};

export default function TermsPage() {
  return (
    <article className="space-y-10">
      <header className="space-y-3">
        <p className="text-xs font-black uppercase tracking-widest text-rose-600 dark:text-rose-400">
          Terms of Service
        </p>
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
          The agreement between you and{' '}
          <LegalValue value={legalIdentity.entityName} />
        </h1>
        <p className="max-w-3xl text-sm leading-7 text-slate-600 dark:text-slate-300">
          These terms apply when you create a CraveOS account, place an order,
          buy a membership, or use this website. They are a contract, so please
          read them before you continue.
        </p>
        <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
          Version {LEGAL_POLICY_VERSION} · Last updated {LEGAL_LAST_UPDATED}
        </p>
      </header>

      <LegalIdentitySummary />

      <div className="space-y-9">
        <LegalSection title="1. Who we are">
          <LegalP>
            CraveOS is a multi-brand cloud kitchen storefront operated by{' '}
            <LegalValue value={legalIdentity.entityName} />, with its registered
            address at <LegalValue value={legalIdentity.registeredAddress} />.
            Our FSSAI licence number is{' '}
            <LegalValue value={legalIdentity.fssaiLicence} /> and our GSTIN is{' '}
            <LegalValue value={legalIdentity.gstin} />.
          </LegalP>
          <LegalP>
            We operate two kitchens in Bengaluru: HSR Layout and Indiranagar.
            The menu, prices and delivery availability shown on this site are
            served from our live kitchen database.
          </LegalP>
        </LegalSection>

        <LegalSection title="2. Eligibility and your account">
          <LegalList>
            <li>You must be at least 18 years old to create an account or place an order.</li>
            <li>
              Accounts are identified by email address and signed in with a
              one-time code sent to that address. Keep access to your email
              secure; anyone who can read it may be able to sign in.
            </li>
            <li>
              Provide accurate information. A wrong email address, delivery
              address or phone number can prevent us from fulfilling an order.
            </li>
            <li>
              Do not create accounts to abuse promotions, referrals or refunds.
              We may suspend or close an account that is used for fraud.
            </li>
            <li>
              Tell us immediately if you believe your account has been used
              without your permission.
            </li>
          </LegalList>
        </LegalSection>

        <LegalSection title="3. Orders and acceptance">
          <LegalP>
            A menu listing is an invitation to order, not an offer. Your order
            becomes binding when the kitchen accepts it. Until then we may reject
            the order — for example if an item is unavailable, your address is
            outside the delivery area, or we cannot verify the order.
          </LegalP>
          <LegalP>
            If we reject an order before preparation starts, any money you paid
            is refunded under the{' '}
            <Link className="font-bold text-rose-600 underline dark:text-rose-400" href="/legal/refunds">
              Refunds &amp; cancellations policy
            </Link>
            . Menu availability changes during the day; the cart and checkout
            always show the current server price.
          </LegalP>
          <LegalP>
            Prices are in Indian rupees. Applicable GST and any delivery or
            packaging charges are shown in the checkout quote before you pay.
            The quote is calculated by our server, not by the browser.
          </LegalP>
        </LegalSection>

        <LegalSection title="4. Memberships">
          <LegalList>
            <li>
              Membership plans are prepaid and shown with their price and
              duration before purchase. Buying a plan is a separate purchase
              from an order.
            </li>
            <li>
              All plans include member pricing and free delivery and packaging
              for the duration shown at purchase. The exact benefits are the
              ones displayed on the plan you buy.
            </li>
            <li>
              Memberships do not renew automatically. We will never debit a card
              or wallet for a renewal without a new purchase by you.
            </li>
            <li>
              Buying a paid plan while a free trial is running starts the paid
              plan immediately and ends the remaining trial days. The checkout
              screen says so before you confirm.
            </li>
            <li>
              A renewal extends from the current paid expiry date, not from the
              date you pay.
            </li>
            <li>
              Membership fees are refundable only for a duplicate or unauthorised
              charge, or where the law requires it. Cancelling a plan stops
              future purchases; it does not create a pro-rata refund for unused
              days.
            </li>
          </LegalList>
        </LegalSection>

        <LegalSection title="5. Promotions, coupons and referrals">
          <LegalP>
            Promotional codes are limited offers. Each code states its minimum
            order value, expiry and usage limit, and is applied only when the
            server validates it. A code has no cash value, cannot be sold, and
            may be withdrawn if we detect misuse.
          </LegalP>
          <LegalP>
            Referral rewards are credited only after the invited customer&apos;s
            first order is delivered. The referrer earns ₹100 and the invited
            customer earns ₹50, up to 20 rewarded referrals per referrer. Beyond
            that cap the invited customer still receives ₹50. Rewards are wallet
            credit, not withdrawable cash, and may be reversed if the qualifying
            order is refunded or found to be fraudulent.
          </LegalP>
        </LegalSection>

        <LegalSection title="6. Payments and wallet credit">
          <LegalList>
            <li>
              UPI and card payments are processed by Razorpay. We do not receive
              or store your full card number or UPI credentials.
            </li>
            <li>
              Wallet credit can be used to pay for orders and membership
              purchases. It cannot be withdrawn as cash or transferred to
              another account.
            </li>
            <li>
              If you ask us to close your account while wallet credit remains,
              we will ask you to use it or contact support to resolve it before
              closure. We do not silently forfeit wallet credit.
            </li>
            <li>
              An order is not confirmed as paid until our server verifies the
              payment. Do not rely on a browser callback alone.
            </li>
            <li>
              If a payment is taken twice, or taken for an order we cannot
              fulfil, contact support and we will reconcile it.
            </li>
          </LegalList>
        </LegalSection>

        <LegalSection title="7. Cancellation and refunds">
          <LegalP>
            You may cancel an order before the kitchen accepts it. Once any
            kitchen has accepted the order, preparation has started and
            cancellation is no longer available; quality problems are handled
            through support instead.
          </LegalP>
          <LegalP>
            The full rules, refund methods and timelines are in the{' '}
            <Link className="font-bold text-rose-600 underline dark:text-rose-400" href="/legal/refunds">
              Refunds &amp; cancellations policy
            </Link>
            , which forms part of these terms.
          </LegalP>
        </LegalSection>

        <LegalSection title="8. Delivery">
          <LegalP>
            We deliver only to addresses inside a live kitchen service area. The
            checkout checks your address against that area before payment. The
            delivery target shown is an estimate based on kitchen load and
            distance; traffic and weather can change it.
          </LegalP>
          <LegalP>
            Please keep your phone reachable and share the delivery OTP only
            with the rider at your door. If we cannot reach you or complete the
            handover, the order may be cancelled and may not be refundable
            because the food has already been prepared. More detail is in the{' '}
            <Link className="font-bold text-rose-600 underline dark:text-rose-400" href="/legal/delivery">
              delivery terms
            </Link>
            .
          </LegalP>
        </LegalSection>

        <LegalSection title="9. Acceptable use">
          <LegalList>
            <li>Do not place fraudulent orders or use payment methods you are not authorised to use.</li>
            <li>Do not scrape, copy, reverse engineer or overload the service.</li>
            <li>Do not abuse, threaten or harass kitchen staff, riders or support staff.</li>
            <li>Do not resell food or use the service for unauthorised commercial activity.</li>
          </LegalList>
          <LegalP>
            We may refuse or cancel an order and suspend an account that breaches
            these rules. Where an order is cancelled for a breach, we may retain
            amounts needed to cover food already prepared and payment costs.
          </LegalP>
        </LegalSection>

        <LegalSection title="10. Content and intellectual property">
          <LegalP>
            The CraveOS name, brand names, menu descriptions, photographs and
            page design are owned by us or our licensors. You may view and use
            the site for personal ordering. You may not copy or reuse the content
            commercially without written permission.
          </LegalP>
        </LegalSection>

        <LegalSection title="11. Food, allergens and liability">
          <LegalP>
            Our kitchens handle common allergens including milk, wheat, eggs,
            soy, nuts and sesame. If you have a serious allergy, contact support
            before ordering; we cannot guarantee an allergen-free preparation
            area.
          </LegalP>
          <LegalP>
            Nothing in these terms limits rights that consumer law does not allow
            us to limit. Subject to that, we are responsible for the service with
            reasonable care, and we are not responsible for indirect losses such
            as lost profits or lost opportunity.
          </LegalP>
        </LegalSection>

        <LegalSection title="12. Governing law and disputes">
          <LegalP>
            These terms are governed by the laws of India. Courts at{' '}
            <LegalValue value={legalIdentity.jurisdiction} /> have jurisdiction,
            without affecting any right you have to approach a consumer forum or
            commission.
          </LegalP>
          <LegalP>
            Please contact our grievance officer first so we can try to resolve
            the issue. Details are in the{' '}
            <Link className="font-bold text-rose-600 underline dark:text-rose-400" href="/legal/contact">
              contact and grievance page
            </Link>
            .
          </LegalP>
        </LegalSection>

        <LegalSection title="13. Changes to these terms">
          <LegalP>
            We may update these terms when the service, the law or our policies
            change. The version and date at the top of this page always identify
            the current text. If a change materially affects your rights, we will
            notify you by email or when you next sign in, and the new version
            will apply from that point.
          </LegalP>
        </LegalSection>

        <LegalSection title="14. Contact">
          <dl>
            <LegalDefinition label="Support email">
              <LegalValue value={legalIdentity.supportEmail} />
            </LegalDefinition>
            <LegalDefinition label="Support phone">
              <LegalValue value={legalIdentity.supportPhone} />
            </LegalDefinition>
            <LegalDefinition label="Registered address">
              <LegalValue value={legalIdentity.registeredAddress} />
            </LegalDefinition>
          </dl>
        </LegalSection>
      </div>
    </article>
  );
}
