import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly resend: Resend | null = null;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY || '';
    if (apiKey) {
      this.resend = new Resend(apiKey);
      this.logger.log(`🔑 Resend initialized with key: ${apiKey.substring(0, 5)}...`);
    }
  }

  async sendEmailOtp(email: string, code: string) {
    this.logger.log(`📧 [Resend] OTP ${code} → ${email}`);

    if (!this.resend) {
      this.logger.warn('⚠️  Resend not initialized — no API key found');
      return { success: true };
    }

    // In dev, always use delivered@resend.dev as a safe fallback so the email
    // goes through Resend's sandbox without domain verification being required.
    const toAddress =
      process.env.NODE_ENV === 'development'
        ? (process.env.DEV_EMAIL_RECIPIENT || email)
        : email;

    const { data, error } = await this.resend.emails.send({
      from: 'CraveOS Auth <onboarding@resend.dev>',
      to: [toAddress],
      subject: `${code} is your CraveOS verification code`,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #ffffff; border-radius: 12px; border: 1px solid #e5e7eb;">
          <div style="text-align: center; margin-bottom: 24px;">
            <h1 style="font-size: 28px; font-weight: 900; color: #e11d48; margin: 0;">🍽️ CraveOS</h1>
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
    });

    if (error) {
      // Log the FULL error object so we can diagnose it
      this.logger.error(`❌ Resend error sending to ${toAddress}:`);
      this.logger.error(JSON.stringify(error, null, 2));
    } else {
      this.logger.log(`✅ Email sent! Resend ID: ${data?.id} → ${toAddress}`);
    }

    return { success: true };
  }

  async sendOrderInvoice(email: string, orderId: string, amount: number) {
    this.logger.log(`🧾 [Resend] Invoice ${orderId} (₹${amount}) → ${email}`);

    if (!this.resend) {
      this.logger.warn('⚠️  Resend not initialized — no API key found');
      return { success: true };
    }

    const toAddress =
      process.env.NODE_ENV === 'development'
        ? (process.env.DEV_EMAIL_RECIPIENT || email)
        : email;

    const { data, error } = await this.resend.emails.send({
      from: 'CraveOS Orders <onboarding@resend.dev>',
      to: [toAddress],
      subject: `Order Confirmed! Receipt for ${orderId}`,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #ffffff; border-radius: 12px; border: 1px solid #e5e7eb;">
          <div style="text-align: center; margin-bottom: 24px;">
            <h1 style="font-size: 28px; font-weight: 900; color: #e11d48; margin: 0;">🍽️ CraveOS</h1>
          </div>
          <h2 style="color: #111827; font-size: 20px; text-align: center;">🎉 Order Confirmed!</h2>
          <p style="color: #374151; font-size: 14px; text-align: center;">Thank you for ordering with CraveOS Cloud Kitchens.</p>
          <div style="background: #f9fafb; border-radius: 10px; padding: 20px; margin: 16px 0;">
            <p style="margin: 8px 0; font-size: 14px;"><strong>Order ID:</strong> ${orderId}</p>
            <p style="margin: 8px 0; font-size: 14px;"><strong>Amount Paid:</strong> ₹${amount}</p>
            <p style="margin: 8px 0; font-size: 14px; color: #059669;"><strong>Delivery Fee:</strong> ₹0 (Member Benefit)</p>
          </div>
          <p style="color: #6b7280; font-size: 12px; text-align: center;">Dispatched from your local Cloud Kitchen Hub.</p>
        </div>
      `,
    });

    if (error) {
      this.logger.error(`❌ Resend invoice error:`);
      this.logger.error(JSON.stringify(error, null, 2));
    } else {
      this.logger.log(`✅ Invoice email sent! Resend ID: ${data?.id}`);
    }

    return { success: true };
  }
}
