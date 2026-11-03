import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { escapeHtml } from '../common/utils/html';
import { ResendSender } from './resend-sender';

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface TemplatedEmailOptions {
  to: string;
  subject: string;
  template: string;
  variables: Record<string, string>;
}

export const POSTAL_ADDRESS_MISSING =
  'Campaign email needs a postal address: set EMAIL_POSTAL_ADDRESS on the API. Nothing was sent.';

@Injectable()
export class EmailService {
  private resendInstance?: Resend;
  private readonly fromEmail: string;
  private readonly fromName: string;
  private readonly webUrl: string;
  private readonly sender: ResendSender;
  /** Null until the owner sets EMAIL_POSTAL_ADDRESS. Campaigns refuse to send without it. */
  readonly postalAddress: string | null;

  constructor(private readonly configService: ConfigService) {
    this.postalAddress =
      this.configService.get<string>('EMAIL_POSTAL_ADDRESS')?.replace(/^["']|["']$/g, '').trim() || null;
    this.fromEmail = this.configService.get<string>('RESEND_FROM_EMAIL', 'noreply@attayyibun.com');
    this.fromName = this.configService.get<string>('RESEND_FROM_NAME', 'At-Tayyibun');
    this.webUrl = this.configService.get<string>('WEB_URL', 'http://localhost:3000');
    const num = (key: string, fallback: number) => {
      const n = Number(this.configService.get<string>(key));
      return Number.isFinite(n) && n > 0 ? n : fallback;
    };
    this.sender = new ResendSender({
      rps: num('RESEND_RATE_LIMIT_RPS', 2),
      maxAttempts: num('RESEND_MAX_ATTEMPTS', 5),
    });
  }

  // Lazy: don't instantiate Resend at boot. The Resend constructor throws on
  // missing key, which would crash the whole API on startup if RESEND_API_KEY
  // is not configured. Defer until an email is actually being sent.
  private get resend(): Resend {
    if (!this.resendInstance) {
      const apiKey = this.configService.get<string>('RESEND_API_KEY');
      if (!apiKey) {
        throw new Error('RESEND_API_KEY not configured; email sending disabled');
      }
      this.resendInstance = new Resend(apiKey);
    }
    return this.resendInstance;
  }

  private get from(): string {
    return `${this.fromName} <${this.fromEmail}>`;
  }

  /**
   * Send a simple email
   */
  async sendEmail(options: EmailOptions): Promise<void> {
    try {
      // No idempotency key: only 429s (rejected before processing) are retried.
      await this.sender.run(
        () =>
          this.resend.emails.send({
            from: this.from,
            to: options.to,
            subject: options.subject,
            html: options.html,
            text: options.text || this.stripHtml(options.html),
          }),
        { kind: 'transactional', idempotent: false },
      );
    } catch (error) {
      console.error('Email send error:', error);
      throw new Error('Failed to send email');
    }
  }

  /**
   * Send one marketing email: postal address, unsubscribe link and one-click
   * headers (CAN-SPAM, RFC 8058). Throws rather than sends if the address is
   * unset, and on a provider error, which Resend returns instead of throwing.
   */
  async sendCampaignEmail(options: {
    to: string;
    subject: string;
    html: string;
    unsubscribeUrl: string;
    oneClickUrl: string;
    /** Stable per (campaign, recipient). Lets Resend dedupe a retry for 24 hours. */
    idempotencyKey?: string;
  }): Promise<void> {
    if (!this.postalAddress) throw new Error(POSTAL_ADDRESS_MISSING);

    const footer = `
      <div style="text-align: center; color: #999; font-size: 11px; margin-top: 20px; padding: 0 20px;">
        <p>At-Tayyibun, ${escapeHtml(this.postalAddress)}</p>
        <p>You received this email because you have an account on At-Tayyibun. <a href="${escapeHtml(options.unsubscribeUrl)}" style="color: #999;">Unsubscribe</a></p>
      </div>`;
    const closing = options.html.toLowerCase().lastIndexOf('</body>');
    const html =
      closing === -1 ? options.html + footer : options.html.slice(0, closing) + footer + options.html.slice(closing);

    const payload = {
      from: this.from,
      to: options.to,
      subject: options.subject,
      html,
      text: this.stripHtml(html),
      headers: {
        'List-Unsubscribe': `<${options.oneClickUrl}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    };
    // Throws ResendSendError (message "Resend refused the email: <code>") on a
    // refusal or when retries run out; the caller then leaves the member unsent.
    const key = options.idempotencyKey;
    await this.sender.run(
      () => this.resend.emails.send(payload, key ? { idempotencyKey: key } : undefined),
      { kind: 'campaign', idempotent: !!key },
    );
  }

  /**
   * Send a templated email with variable substitution
   */
  async sendTemplatedEmail(options: TemplatedEmailOptions): Promise<void> {
    let html = options.template;
    for (const [key, value] of Object.entries(options.variables)) {
      html = html.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }
    await this.sendEmail({ to: options.to, subject: options.subject, html });
  }

  /**
   * Send welcome email after signup
   */
  async sendWelcomeEmail(email: string, firstName: string): Promise<void> {
    const safeFirstName = escapeHtml(firstName);
    const html = this.wrapInLayout(`
      <h2 style="color: #1a1a2e; margin-bottom: 16px;">Welcome to At-Tayyibun, ${safeFirstName}!</h2>
      <p>Assalamu Alaikum wa Rahmatullahi wa Barakatuh,</p>
      <p>We are delighted to welcome you to <strong>At-Tayyibun</strong> - a privacy-first Muslim matrimony platform built on trust, respect, and Islamic values.</p>
      <div style="background: #f8f4ed; padding: 20px; border-radius: 8px; margin: 24px 0; border-left: 4px solid #D4AF37;">
        <h3 style="margin-top: 0; color: #8B7500;">Getting Started:</h3>
        <ul style="color: #555; line-height: 1.8;">
          <li>Complete your profile to appear in search results</li>
          <li>Browse profiles and send contact requests</li>
          <li>Respond to requests you receive</li>
          <li>Your private info is encrypted and only shared with your approval</li>
        </ul>
      </div>
      <p>May Allah guide you to a righteous spouse and bless your journey.</p>
      <a href="${this.webUrl}/browse" style="display: inline-block; background: linear-gradient(135deg, #D4AF37, #8B7500); color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 8px;">Start Browsing</a>
    `);

    await this.sendEmail({
      to: email,
      subject: 'Welcome to At-Tayyibun - Your Journey Begins!',
      html,
    });
  }

  /**
   * Send email verification link
   */
  async sendVerificationEmail(email: string, firstName: string, verificationToken: string): Promise<void> {
    const verifyUrl = `${this.webUrl}/verify-email?token=${encodeURIComponent(verificationToken)}`;
    const safeFirstName = escapeHtml(firstName);
    const html = this.wrapInLayout(`
      <h2 style="color: #1a1a2e; margin-bottom: 16px;">Verify Your Email</h2>
      <p>Assalamu Alaikum ${safeFirstName},</p>
      <p>Please verify your email address to activate your At-Tayyibun account.</p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${verifyUrl}" style="display: inline-block; background: linear-gradient(135deg, #D4AF37, #8B7500); color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold;">Verify My Email</a>
      </div>
      <p style="color: #888; font-size: 13px;">This link will expire in 24 hours. If you did not create an account, please ignore this email.</p>
    `);

    await this.sendEmail({
      to: email,
      subject: 'Verify Your Email - At-Tayyibun',
      html,
    });
  }

  /**
   * Send a nudge to an account that signed up by email but never verified a
   * phone number (and therefore has no profile). Sent on demand from the admin
   * panel — never automatically.
   */
  async sendVerifyPhoneNudgeEmail(email: string, firstName: string | null): Promise<void> {
    const safeFirstName = escapeHtml(firstName || 'there');
    const loginUrl = `${this.webUrl}/login?next=%2Fverify-phone`;
    const html = this.wrapInLayout(`
      <h2 style="color: #1a1a2e; margin-bottom: 16px;">Finish setting up your account</h2>
      <p>Assalamu Alaikum ${safeFirstName},</p>
      <p>You started signing up for <strong>At-Tayyibun</strong> but your account is not active yet. One step is left: verify your phone number.</p>
      <div style="background: #f8f4ed; padding: 20px; border-radius: 8px; margin: 24px 0; border-left: 4px solid #D4AF37;">
        <p style="margin: 0 0 10px; color: #8B7500;"><strong>Why verify?</strong></p>
        <p style="margin: 0; color: #555;">Phone verification keeps At-Tayyibun a trusted space — helping keep it to one account per person. Once verified, your profile appears in search and you can send and receive contact requests.</p>
      </div>
      <p style="text-align: center; margin: 32px 0;">
        <a href="${loginUrl}" style="display: inline-block; background: linear-gradient(135deg, #D4AF37, #8B7500); color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold;">Verify My Phone</a>
      </p>
      <p style="color: #888; font-size: 13px;">After signing in you will land directly on the phone verification step.</p>
    `);

    await this.sendEmail({
      to: email,
      subject: 'One step left — verify your phone to activate your At-Tayyibun account',
      html,
    });
  }

  /**
   * Send notification to target when someone requests their contact
   */
  async sendContactRequestEmail(
    targetEmail: string,
    targetName: string,
    requesterName: string,
    requesterEthnicity: string,
    requesterCity: string,
  ): Promise<void> {
    const safeTargetName = escapeHtml(targetName);
    const safeRequesterName = escapeHtml(requesterName);
    const safeRequesterEthnicity = escapeHtml(requesterEthnicity);
    const safeRequesterCity = escapeHtml(requesterCity);
    const html = this.wrapInLayout(`
      <h2 style="color: #1a1a2e; margin-bottom: 16px;">New Contact Request</h2>
      <p>Assalamu Alaikum ${safeTargetName},</p>
      <p>Someone is interested in connecting with you on At-Tayyibun!</p>
      <div style="background: #f8f4ed; padding: 20px; border-radius: 8px; margin: 24px 0; border-left: 4px solid #D4AF37;">
        <h3 style="margin-top: 0; color: #8B7500;">Request From:</h3>
        <p style="margin: 4px 0;"><strong>Name:</strong> ${safeRequesterName}</p>
        <p style="margin: 4px 0;"><strong>Ethnicity:</strong> ${safeRequesterEthnicity}</p>
        <p style="margin: 4px 0;"><strong>Location:</strong> ${safeRequesterCity}</p>
      </div>
      <p>You can accept or decline this request from your dashboard:</p>
      <a href="${this.webUrl}/requests" style="display: inline-block; background: linear-gradient(135deg, #D4AF37, #8B7500); color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 8px;">View Request</a>
    `);

    await this.sendEmail({
      to: targetEmail,
      subject: `At-Tayyibun: ${safeRequesterName} wants to connect with you`,
      html,
    });
  }

  /**
   * Tell a requester their request was approved. Carries a link only, never the
   * contact details: the link needs the requester's login, so a forwarded or
   * stored email exposes nothing.
   */
  async sendContactLinkEmail(
    recipientEmail: string,
    recipientName: string,
    sharedBy: string,
    requestId: string,
    linkDays: number,
  ): Promise<void> {
    const safeRecipientName = escapeHtml(recipientName);
    const safeSharedBy = escapeHtml(sharedBy);
    const link = `${this.webUrl}/requests/${encodeURIComponent(requestId)}/contact`;

    const html = this.wrapInLayout(`
      <h2 style="color: #1a1a2e; margin-bottom: 16px;">Your Request Was Accepted</h2>
      <p>Assalamu Alaikum ${safeRecipientName},</p>
      <p><strong>${safeSharedBy}</strong> has accepted your request and chosen a contact to share with you.</p>
      <p style="margin: 24px 0;"><a href="${escapeHtml(link)}" style="background: #D4AF37; color: #1a1a2e; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">View contact details</a></p>
      <p>You will need to sign in. The details can be viewed once, within ${linkDays} days, so please save them when you open them.</p>
      <p>May Allah bless your journey towards finding a righteous spouse.</p>
    `);

    await this.sendEmail({
      to: recipientEmail,
      subject: `At-Tayyibun: ${sharedBy} accepted your request`,
      html,
    });
  }

  /**
   * Send notification when a request is denied
   */
  async sendRequestDeniedEmail(
    requesterEmail: string,
    requesterName: string,
  ): Promise<void> {
    const safeRequesterName = escapeHtml(requesterName);
    const html = this.wrapInLayout(`
      <h2 style="color: #1a1a2e; margin-bottom: 16px;">Request Update</h2>
      <p>Assalamu Alaikum ${safeRequesterName},</p>
      <p>Your recent contact request was not accepted. Don't be discouraged - there are many wonderful profiles waiting for you.</p>
      <p>You are now free to send a new contact request to another profile.</p>
      <a href="${this.webUrl}/browse" style="display: inline-block; background: linear-gradient(135deg, #D4AF37, #8B7500); color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 8px;">Browse Profiles</a>
      <p style="color: #888; font-size: 13px; margin-top: 24px;">May Allah guide you to the best match, Ameen.</p>
    `);

    await this.sendEmail({
      to: requesterEmail,
      subject: 'At-Tayyibun: Request Update',
      html,
    });
  }

  /**
   * Consistent email layout wrapper
   */
  private wrapInLayout(content: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f0f0f0;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #1a1a2e, #16213e); color: white; padding: 32px 24px; text-align: center; border-radius: 12px 12px 0 0;">
            <img src="${this.webUrl}/at-tayyibun-logo.png" alt="At-Tayyibun Logo" style="width: 80px; height: 80px; margin-bottom: 16px; object-fit: contain;" />
            <h1 style="margin: 0; font-size: 28px; letter-spacing: 1px;">
              <span style="color: #D4AF37;">At-Tayyibun</span>
            </h1>
            <p style="margin: 4px 0 0; font-size: 13px; color: #aaa;">Privacy-First Muslim Matrimony</p>
          </div>
          <div style="background: white; padding: 32px; border-radius: 0 0 12px 12px;">
            ${content}
          </div>
          <div style="text-align: center; color: #999; font-size: 11px; margin-top: 20px; padding: 0 20px;">
            <p>At-Tayyibun - Privacy-First Muslim Matrimony</p>
            ${this.postalAddress ? `<p>${escapeHtml(this.postalAddress)}</p>` : ''}
            <p>This is a service message about your At-Tayyibun account.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Strip HTML tags for plain text version
   */
  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  }
}
