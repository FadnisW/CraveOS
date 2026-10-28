import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';
import { PrismaService } from '../../common/prisma/prisma.service';

type DeliveryResult =
  | { success: true; providerId?: string }
  | { success: false; error: string };

type LifecycleKind =
  | 'ORDER_PLACED'
  | 'ORDER_ACCEPTED'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'MEMBERSHIP';

interface LifecycleEmail {
  kind: LifecycleKind;
  email: string;
  userId?: string | null;
  orderId?: string | null;
  subject: string;
  html: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly resend: Resend | null = null;

  constructor(private readonly prisma: PrismaService) {
    const apiKey = process.env.RESEND_API_KEY || '';
    if (apiKey) {
      this.resend = new Resend(apiKey);
      this.logger.log('Resend client initialised');
    } else {
      this.logger.warn('RESEND_API_KEY is not set — email delivery is unavailable');
    }
  }

  private fromAddress(kind: 'auth' | 'orders' | 'membership') {
    const configured = process.env.RESEND_FROM_EMAIL?.trim();
    if (configured) return configured;

    // Resend's shared sender only delivers to the account owner. Production
    // must configure a verified domain address in RESEND_FROM_EMAIL.
    const label =
      kind === 'auth'
        ? 'CraveOS Auth'
        : kind === 'orders'
          ? 'CraveOS Orders'
          : 'CraveOS Membership';
    return `${label} <onboarding@resend.dev>`;
  }

  private recipient(email: string) {
    return process.env.NODE_ENV === 'development'
      ? process.env.DEV_EMAIL_RECIPIENT || email
      : email;
  }

  private async send(
    kind: 'auth' | 'orders' | 'membership',
    email: string,
    subject: string,
    html: string,
  ): Promise<DeliveryResult> {
    if (!this.resend) {
      return { success: false, error: 'Email delivery is not configured (RESEND_API_KEY missing).' };
    }

    const toAddress = this.recipient(email);

    try {
      const { data, error } = await this.resend.emails.send({
        from: this.fromAddress(kind),
        to: [toAddress],
        subject,
        html,
      });

      if (error) {
        this.logger.error(`Resend rejected ${kind} email: ${JSON.stringify(error)}`);
        return { success: false, error: error.message || 'The email provider rejected the message.' };
      }

      this.logger.log(`${kind} email accepted by Resend (id ${data?.id ?? 'unknown'})`);
      // no-fakes-allow: silent-notification-success Resend accepted the message and returned no error.
      return { success: true, providerId: data?.id };
    } catch (err: any) {
      this.logger.error(`Resend ${kind} email failed: ${err?.message || 'unknown error'}`);
      return { success: false, error: err?.message || 'The email provider is unreachable.' };
    }
  }

  async sendEmailOtp(email: string, code: string): Promise<DeliveryResult> {
    return this.send(
      'auth',
      email,
      `${code} is your CraveOS verification code`,
      `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #ffffff; border-radius: 12px; border: 1px solid #e5e7eb;">
          <div style="text-align: center; margin-bottom: 24px;">
            <h1 style="font-size: 28px; font-weight: 900; color: #e11d48; margin: 0;">CraveOS</h1>
            <p style="color: #6b7280; font-size: 13px; margin: 4px 0 0;">Cloud Kitchen Platform</p>
          </div>
          <p style="color: #111827; font-size: 15px; font-weight: 600; text-align: center;">Your verification code</p>
          <div style="background: #f9fafb; border: 2px dashed #e11d48; border-radius: 10px; padding: 20px; text-align: center; margin: 16px 0;">
            <span style="font-size: 40px; font-weight: 900; letter-spacing: 8px; color: #111827;">${code}</span>
          </div>
          <p style="color: #6b7280; font-size: 12px; text-align: center; margin-top: 16px;">
            Valid for <strong>10 minutes</strong>. Do not share this code with anyone.
          </p>
        </div>
      `,
    );
  }

  async sendOrderInvoice(email: string, orderId: string, amount: number): Promise<DeliveryResult> {
    return this.send(
      'orders',
      email,
      `Receipt for order ${orderId}`,
      `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #ffffff; border-radius: 12px; border: 1px solid #e5e7eb;">
          <div style="text-align: center; margin-bottom: 24px;">
            <h1 style="font-size: 28px; font-weight: 900; color: #e11d48; margin: 0;">CraveOS</h1>
          </div>
          <h2 style="color: #111827; font-size: 20px; text-align: center;">Order receipt</h2>
          <p style="color: #374151; font-size: 14px; text-align: center;">Thank you for ordering with CraveOS Cloud Kitchens.</p>
          <div style="background: #f9fafb; border-radius: 10px; padding: 20px; margin: 16px 0;">
            <p style="margin: 8px 0; font-size: 14px;"><strong>Order ID:</strong> ${orderId}</p>
            <p style="margin: 8px 0; font-size: 14px;"><strong>Amount paid:</strong> ₹${amount}</p>
          </div>
          <p style="color: #6b7280; font-size: 12px; text-align: center;">The full itemised bill is available in your order history.</p>
        </div>
      `,
    );
  }

  async sendMembershipExpiryEmail(email: string, userName?: string): Promise<DeliveryResult> {
    return this.send(
      'membership',
      email,
      'Your EatClub trial has ended',
      `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #ffffff; border-radius: 12px; border: 1px solid #e5e7eb;">
          <div style="text-align: center; margin-bottom: 24px;">
            <h1 style="font-size: 28px; font-weight: 900; color: #e11d48; margin: 0;">CraveOS</h1>
            <p style="color: #6b7280; font-size: 13px; margin: 4px 0 0;">Cloud Kitchen Platform</p>
          </div>
          <h2 style="color: #111827; font-size: 20px; text-align: center;">Your trial has ended</h2>
          <p style="color: #374151; font-size: 14px; text-align: center;">
            Hi ${userName || 'there'}, your EatClub trial membership has ended. Member pricing and free delivery no longer apply to new orders.
          </p>
          <p style="color: #6b7280; font-size: 12px; text-align: center; margin-top: 16px;">
            You can keep ordering at standard menu prices.
          </p>
        </div>
      `,
    );
  }

  /**
   * Sends a customer lifecycle email and records the outcome in
   * `notification_logs`. A missing provider is recorded as SKIPPED, never as a
   * successful send, so operations can see exactly which messages never left.
   */
  private async sendLifecycle(input: LifecycleEmail): Promise<DeliveryResult> {
    // Status emails are edge-triggered. The hub handoff desk and the rider
    // pickup endpoint can both mark the same order OUT_FOR_DELIVERY, so a
    // previously SENT row for this order+kind is the idempotency guard.
    if (input.orderId) {
      const alreadySent = await this.prisma.notificationLog.findFirst({
        where: {
          orderId: input.orderId,
          kind: input.kind,
          status: 'SENT',
        },
        select: { id: true },
      });
      // no-fakes-allow: silent-notification-success A duplicate is not a send; the first SENT row proves delivery.
      if (alreadySent) return { success: true };
    }

    const recipient = this.recipient(input.email);
    const kind = input.kind === 'MEMBERSHIP' ? 'membership' : 'orders';
    const result = await this.send(kind, input.email, input.subject, input.html);

    const status = result.success
      ? 'SENT'
      : result.error.includes('not configured')
        ? 'SKIPPED'
        : 'FAILED';

    try {
      await this.prisma.notificationLog.create({
        data: {
          userId: input.userId ?? null,
          orderId: input.orderId ?? null,
          kind: input.kind,
          recipient,
          status,
          providerId: result.success ? result.providerId ?? null : null,
          error: result.success ? null : result.error,
        },
      });
    } catch (err: any) {
      // A logging failure must not break the order or payment flow.
      this.logger.error(
        `Failed to record ${input.kind} notification: ${err?.message || 'unknown error'}`,
      );
    }

    return result;
  }

  async sendOrderPlacedEmail(
    email: string,
    orderId: string,
    amountPaise: number,
    userId?: string | null,
  ): Promise<DeliveryResult> {
    return this.sendLifecycle({
      kind: 'ORDER_PLACED',
      email,
      userId,
      orderId,
      subject: `Order ${orderId.slice(0, 8)} confirmed`,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #ffffff; border-radius: 12px; border: 1px solid #e5e7eb;">
          <h1 style="font-size: 26px; font-weight: 900; color: #e11d48; margin: 0 0 16px;">CraveOS</h1>
          <h2 style="color: #111827; font-size: 20px;">Your order is confirmed</h2>
          <p style="color: #374151; font-size: 14px;">Order <strong>${orderId}</strong> has reached the kitchen.</p>
          <p style="color: #374151; font-size: 14px;">Amount paid: <strong>₹${(amountPaise / 100).toFixed(2)}</strong></p>
          <p style="color: #6b7280; font-size: 12px;">Track the live status in your order history.</p>
        </div>
      `,
    });
  }

  async sendOrderStatusEmail(
    email: string,
    orderId: string,
    status: 'ACCEPTED' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED',
    userId?: string | null,
  ): Promise<DeliveryResult> {
    const copy = {
      ACCEPTED: {
        subject: `Order ${orderId.slice(0, 8)} accepted by the kitchen`,
        heading: 'The kitchen accepted your order',
        body: 'Your food is now being prepared.',
      },
      OUT_FOR_DELIVERY: {
        subject: `Order ${orderId.slice(0, 8)} is on the way`,
        heading: 'Your order is out for delivery',
        body: 'The rider is on the way. Keep your delivery code ready.',
      },
      DELIVERED: {
        subject: `Order ${orderId.slice(0, 8)} delivered`,
        heading: 'Delivered. Enjoy your meal.',
        body: 'You can now write a verified-purchase review from your order history.',
      },
      CANCELLED: {
        subject: `Order ${orderId.slice(0, 8)} cancelled`,
        heading: 'Your order was cancelled',
        body: 'Any amount collected is returned by the server: wallet credit immediately, card and UPI to the original method in 5-7 working days.',
      },
    }[status];

    return this.sendLifecycle({
      kind: status === 'ACCEPTED' ? 'ORDER_ACCEPTED' : status,
      email,
      userId,
      orderId,
      subject: copy.subject,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #ffffff; border-radius: 12px; border: 1px solid #e5e7eb;">
          <h1 style="font-size: 26px; font-weight: 900; color: #e11d48; margin: 0 0 16px;">CraveOS</h1>
          <h2 style="color: #111827; font-size: 20px;">${copy.heading}</h2>
          <p style="color: #374151; font-size: 14px;">${copy.body}</p>
          <p style="color: #6b7280; font-size: 12px;">Order <strong>${orderId}</strong></p>
        </div>
      `,
    });
  }

  async sendMembershipActiveEmail(
    email: string,
    planName: string,
    endsAt: Date,
    userId?: string | null,
  ): Promise<DeliveryResult> {
    return this.sendLifecycle({
      kind: 'MEMBERSHIP',
      email,
      userId,
      subject: `${planName} is active`,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #ffffff; border-radius: 12px; border: 1px solid #e5e7eb;">
          <h1 style="font-size: 26px; font-weight: 900; color: #e11d48; margin: 0 0 16px;">CraveOS</h1>
          <h2 style="color: #111827; font-size: 20px;">${planName} is active</h2>
          <p style="color: #374151; font-size: 14px;">Member pricing and free delivery now apply to your orders.</p>
          <p style="color: #374151; font-size: 14px;">Valid until <strong>${endsAt.toLocaleDateString('en-IN')}</strong>.</p>
        </div>
      `,
    });
  }
}
