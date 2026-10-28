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
  title: 'Privacy Policy',
  description:
    'What CraveOS collects, why it is needed, who it is shared with, how long it is kept, and how to exercise your privacy rights.',
};

export default function PrivacyPage() {
  return (
    <article className="space-y-10">
      <header className="space-y-3">
        <p className="text-xs font-black uppercase tracking-widest text-rose-600 dark:text-rose-400">
          Privacy Policy
        </p>
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
          What we collect, and what we do with it
        </h1>
        <p className="max-w-3xl text-sm leading-7 text-slate-600 dark:text-slate-300">
          This policy explains the personal data CraveOS needs to take an order,
          cook it, deliver it and support you afterwards. It applies to this
          website and to the kitchen and delivery teams who fulfil your order.
        </p>
        <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
          Version {LEGAL_POLICY_VERSION} · Last updated {LEGAL_LAST_UPDATED}
        </p>
      </header>

      <LegalIdentitySummary />

      <div className="space-y-9">
        <LegalSection title="1. Who is responsible for your data">
          <LegalP>
            <LegalValue value={legalIdentity.entityName} />, registered at{' '}
            <LegalValue value={legalIdentity.registeredAddress} />, decides why
            and how personal data is processed for the CraveOS service. You can
            reach us at <LegalValue value={legalIdentity.supportEmail} /> or{' '}
            <LegalValue value={legalIdentity.supportPhone} />.
          </LegalP>
        </LegalSection>

        <LegalSection title="2. What we collect">
          <LegalList>
            <li>
              <strong>Account data:</strong> email address, display name, account
              role, referral code, and the time and version of the Terms and
              Privacy Policy you accepted.
            </li>
            <li>
              <strong>Delivery data:</strong> phone number, saved addresses,
              landmark, city, pincode and map coordinates. Phone is collected as
              a delivery contact, not as a login identifier.
            </li>
            <li>
              <strong>Order data:</strong> items, quantities, prices, discounts,
              taxes, delivery and packaging charges, order status, kitchen
              tickets, delivery status and the delivery OTP.
            </li>
            <li>
              <strong>Payment data:</strong> the payment method you choose, the
              amount, the gateway payment or refund identifier, and whether the
              payment succeeded. Card numbers and UPI credentials are handled by
              Razorpay and are not stored by us.
            </li>
            <li>
              <strong>Membership and rewards data:</strong> the plan you bought,
              its start and end dates, wallet balance and wallet transactions,
              coupon redemptions and referral rewards.
            </li>
            <li>
              <strong>Support data:</strong> the messages you send us and the
              order details needed to answer them.
            </li>
            <li>
              <strong>Technical data:</strong> IP address and request metadata
              used for rate limiting, security, error diagnosis and keeping the
              service available. We do not use advertising or analytics trackers.
            </li>
          </LegalList>
        </LegalSection>

        <LegalSection title="3. Why we use it">
          <LegalList>
            <li>To create and secure your account, send one-time sign-in codes and keep you signed in.</li>
            <li>To check whether your address is deliverable and calculate the server-side price quote.</li>
            <li>To prepare, pack and deliver your order, and to let you track it.</li>
            <li>To take payment, issue refunds, and keep GST and accounting records.</li>
            <li>To administer memberships, coupons, referrals and wallet credit.</li>
            <li>To answer support requests, investigate missing or spoiled items, and resolve disputes.</li>
            <li>To detect fraud and abuse, protect the service, and enforce our terms.</li>
            <li>To meet legal, tax and regulatory obligations.</li>
          </LegalList>
        </LegalSection>

        <LegalSection title="4. Our legal basis">
          <LegalP>
            We process account, order and delivery data because it is necessary
            to perform the contract you enter when you order. We rely on consent
            for the signup acceptance you give, for optional support
            communications, and for any processing that asks for it. We process
            payment, tax and fraud-prevention records to comply with legal
            obligations and to pursue our legitimate interest in keeping the
            service safe, balanced against your rights.
          </LegalP>
          <LegalP>
            You can withdraw consent at any time by contacting us. Withdrawing
            consent does not affect processing that already happened, and it may
            mean we can no longer provide an account or fulfil a live order.
          </LegalP>
        </LegalSection>

        <LegalSection title="5. Who we share it with">
          <LegalList>
            <li>
              <strong>Kitchen and hub teams</strong> see the items, order notes
              and delivery area needed to cook and dispatch the order.
            </li>
            <li>
              <strong>Delivery riders</strong> see the customer name, delivery
              address, phone number, order value to collect where applicable,
              and the delivery OTP flow.
            </li>
            <li>
              <strong>Razorpay</strong> processes UPI and card payments and
              refunds. Its own privacy policy applies to the payment page.
            </li>
            <li>
              <strong>Resend</strong> delivers one-time sign-in emails. It
              receives the email address and the message content.
            </li>
            <li>
              <strong>Hosting and infrastructure providers</strong> process data
              on our instructions so the site, database and queue can run.
            </li>
            <li>
              <strong>Professional advisers, auditors, courts and authorities</strong>{' '}
              where required by law, to collect a debt, or to investigate fraud
              or a legal claim.
            </li>
          </LegalList>
          <LegalP>
            We do not sell personal data. We do not share it with advertisers.
            Some providers may process data outside India; where that happens we
            rely on the contractual and legal safeguards available to us.
          </LegalP>
        </LegalSection>

        <LegalSection title="6. How long we keep it">
          <LegalList>
            <li>
              <strong>Account and profile data:</strong> name, email, phone,
              cart, saved addresses not attached to an order, and the current
              membership are deleted or anonymised within 30 days of a verified
              account-deletion request. If wallet credit remains, we ask you to
              use it or contact support to resolve it first; we do not silently
              forfeit it. A live order must also be delivered or cancelled
              first.
            </li>
            <li>
              <strong>Order, invoice, payment and tax records:</strong> retained
              for 8 years after the transaction, as required for GST and
              accounting. These records include the delivery address attached to
              an order, payment and refund identifiers, and the wallet ledger.
              They are kept after the account is closed but are restricted to
              finance, compliance and dispute use.
            </li>
            <li>
              <strong>Support conversations:</strong> kept with the account and
              deleted or anonymised with it, unless an open dispute or legal
              obligation requires us to keep them longer.
            </li>
            <li>
              <strong>Security data:</strong> one-time codes expire within 10
              minutes; rate-limit counters expire within 15 minutes; revoked
              session identifiers are kept only until the token would have
              expired.
            </li>
          </LegalList>
        </LegalSection>

        <LegalSection title="7. How we protect it">
          <LegalP>
            Sign-in uses short-lived one-time codes. Browser sessions are held in
            an httpOnly cookie and the access token is never exposed to page
            JavaScript. Signing out revokes the session on the server. Payment
            card data never reaches our servers. Access to order and customer
            data is limited by role, and administrative actions are audited.
          </LegalP>
          <LegalP>
            No service can promise absolute security. If a breach affects your
            personal data, we will notify you and the relevant authority as
            required by law.
          </LegalP>
        </LegalSection>

        <LegalSection title="8. Your rights">
          <LegalP>
            Subject to applicable law, you can ask us to:
          </LegalP>
          <LegalList>
            <li>confirm what personal data we hold about you and give you a copy;</li>
            <li>correct data that is wrong or incomplete;</li>
            <li>delete your account and personal data, subject to records we must keep by law;</li>
            <li>withdraw consent you previously gave;</li>
            <li>explain how your data has been shared; and</li>
            <li>consider a grievance about how your data has been handled.</li>
          </LegalList>
          <LegalP>
            Email <LegalValue value={legalIdentity.grievanceOfficerEmail} /> with
            the request and the email address on your account. We may ask you to
            verify that you control the account before we act. We aim to
            acknowledge a request within 48 hours and to resolve it within 30
            days. If we need longer, we will tell you why.
          </LegalP>
          <LegalP>
            You can also complain to the Data Protection Board of India or the
            appropriate consumer authority. We would appreciate the chance to
            resolve it first.
          </LegalP>
        </LegalSection>

        <LegalSection title="9. Cookies and local storage">
          <LegalP>
            We use one essential first-party cookie to keep you signed in. It is
            httpOnly, SameSite=Lax, and Secure in production. We do not set
            advertising, profiling or analytics cookies. When you open the
            Razorpay checkout, Razorpay may set its own cookies on its domain;
            its privacy policy applies to that page.
          </LegalP>
        </LegalSection>

        <LegalSection title="10. Children">
          <LegalP>
            The service is for people aged 18 and over. We do not knowingly
            create accounts for children. If you believe a child has given us
            personal data, contact us and we will delete it.
          </LegalP>
        </LegalSection>

        <LegalSection title="11. Changes to this policy">
          <LegalP>
            We may update this policy when our service or the law changes. The
            version and date at the top identify the current text. If a change
            materially affects how we use your data, we will notify you by email
            or when you next sign in and, where required, ask for consent again.
          </LegalP>
        </LegalSection>

        <LegalSection title="12. Grievance officer">
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
            The grievance officer also handles complaints about orders and
            refunds. See the{' '}
            <Link className="font-bold text-rose-600 underline dark:text-rose-400" href="/legal/contact">
              contact page
            </Link>{' '}
            for the response timeline.
          </LegalP>
        </LegalSection>
      </div>
    </article>
  );
}
