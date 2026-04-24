import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

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

@Injectable()
export class EmailService {
  private readonly resend: Resend;
  private readonly fromEmail: string;
  private readonly fromName: string;
  private readonly webUrl: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY', '');
    this.resend = new Resend(apiKey);
    this.fromEmail = this.configService.get<string>('RESEND_FROM_EMAIL', 'noreply@attayyibun.com');
    this.fromName = this.configService.get<string>('RESEND_FROM_NAME', 'At-Tayyibun');
    this.webUrl = this.configService.get<string>('WEB_URL', 'http://localhost:3000');
  }

  private get from(): string {
    return `${this.fromName} <${this.fromEmail}>`;
  }

  /**
   * Send a simple email
   */
  async sendEmail(options: EmailOptions): Promise<void> {
    try {
      await this.resend.emails.send({
        from: this.from,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text || this.stripHtml(options.html),
      });
    } catch (error) {
      console.error('Email send error:', error);
      throw new Error('Failed to send email');
    }
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
    const html = this.wrapInLayout(`
      <h2 style="color: #1a1a2e; margin-bottom: 16px;">Welcome to At-Tayyibun, ${firstName}!</h2>
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
    const verifyUrl = `${this.webUrl}/verify-email?token=${verificationToken}`;
    const html = this.wrapInLayout(`
      <h2 style="color: #1a1a2e; margin-bottom: 16px;">Verify Your Email</h2>
      <p>Assalamu Alaikum ${firstName},</p>
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
   * Send notification to target when someone requests their contact
   */
  async sendContactRequestEmail(
    targetEmail: string,
    targetName: string,
    requesterName: string,
    requesterEthnicity: string,
    requesterCity: string,
  ): Promise<void> {
    const html = this.wrapInLayout(`
      <h2 style="color: #1a1a2e; margin-bottom: 16px;">New Contact Request</h2>
      <p>Assalamu Alaikum ${targetName},</p>
      <p>Someone is interested in connecting with you on At-Tayyibun!</p>
      <div style="background: #f8f4ed; padding: 20px; border-radius: 8px; margin: 24px 0; border-left: 4px solid #D4AF37;">
        <h3 style="margin-top: 0; color: #8B7500;">Request From:</h3>
        <p style="margin: 4px 0;"><strong>Name:</strong> ${requesterName}</p>
        <p style="margin: 4px 0;"><strong>Ethnicity:</strong> ${requesterEthnicity}</p>
        <p style="margin: 4px 0;"><strong>Location:</strong> ${requesterCity}</p>
      </div>
      <p>You can accept or decline this request from your dashboard:</p>
      <a href="${this.webUrl}/requests" style="display: inline-block; background: linear-gradient(135deg, #D4AF37, #8B7500); color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 8px;">View Request</a>
    `);

    await this.sendEmail({
      to: targetEmail,
      subject: `At-Tayyibun: ${requesterName} wants to connect with you`,
      html,
    });
  }

  /**
   * Send shared info email when request is approved
   */
  async sendSharedInfoEmail(
    recipientEmail: string,
    recipientName: string,
    sharedBy: string,
    shares: { photo?: string; phone?: string; email?: string },
    expiresIn = '24 hours',
  ): Promise<void> {
    const sharedItems: string[] = [];
    if (shares.photo) {
      sharedItems.push(`<p><strong>Photo:</strong> <a href="${shares.photo}" style="color: #D4AF37;">View Photo</a> (expires in ${expiresIn})</p>`);
    }
    if (shares.phone) {
      sharedItems.push(`<p><strong>Phone:</strong> ${shares.phone}</p>`);
    }
    if (shares.email) {
      sharedItems.push(`<p><strong>Email:</strong> ${shares.email}</p>`);
    }

    const html = this.wrapInLayout(`
      <h2 style="color: #1a1a2e; margin-bottom: 16px;">Contact Information Shared</h2>
      <p>Assalamu Alaikum ${recipientName},</p>
      <p><strong>${sharedBy}</strong> has approved your request and shared the following information with you:</p>
      <div style="background: #f8f4ed; padding: 20px; border-radius: 8px; margin: 24px 0; border-left: 4px solid #D4AF37;">
        ${sharedItems.join('')}
      </div>
      <p style="color: #888; font-size: 13px;">Photo links expire in ${expiresIn} for your privacy and security.</p>
      <p>May Allah bless your journey towards finding a righteous spouse.</p>
    `);

    await this.sendEmail({
      to: recipientEmail,
      subject: `At-Tayyibun: ${sharedBy} has shared their information with you`,
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
    const html = this.wrapInLayout(`
      <h2 style="color: #1a1a2e; margin-bottom: 16px;">Request Update</h2>
      <p>Assalamu Alaikum ${requesterName},</p>
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
            <p>You received this email because you have an account on At-Tayyibun. <a href="${this.webUrl}/unsubscribe" style="color: #999;">Unsubscribe</a></p>
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
