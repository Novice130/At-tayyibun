import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as sgMail from '@sendgrid/mail';

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
  private readonly fromEmail: string;
  private readonly fromName: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('SENDGRID_API_KEY');
    if (apiKey) {
      sgMail.setApiKey(apiKey);
    }

    this.fromEmail = this.configService.get<string>('SENDGRID_FROM_EMAIL', 'noreply@at-tayyibun.com');
    this.fromName = this.configService.get<string>('SENDGRID_FROM_NAME', 'At-Tayyibun');
  }

  /**
   * Send a simple email
   */
  async sendEmail(options: EmailOptions): Promise<void> {
    const msg = {
      to: options.to,
      from: {
        email: this.fromEmail,
        name: this.fromName,
      },
      subject: options.subject,
      html: options.html,
      text: options.text || this.stripHtml(options.html),
    };

    try {
      await sgMail.send(msg);
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

    // Replace variables like {{first_name}}
    for (const [key, value] of Object.entries(options.variables)) {
      html = html.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }

    await this.sendEmail({
      to: options.to,
      subject: options.subject,
      html,
    });
  }

  /**
   * Send shared info email with signed links
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
      sharedItems.push(`<p><strong>Photo:</strong> <a href="${shares.photo}">View Photo</a> (expires in ${expiresIn})</p>`);
    }
    if (shares.phone) {
      sharedItems.push(`<p><strong>Phone:</strong> ${shares.phone}</p>`);
    }
    if (shares.email) {
      sharedItems.push(`<p><strong>Email:</strong> ${shares.email}</p>`);
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #D4AF37, #8B7500); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
          .info-box { background: white; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #D4AF37; }
          .footer { text-align: center; color: #888; font-size: 12px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>At-Tayyibun</h1>
            <p>Information Shared With You</p>
          </div>
          <div class="content">
            <p>Assalamu Alaikum ${recipientName},</p>
            <p><strong>${sharedBy}</strong> has approved your request and shared the following information with you:</p>
            <div class="info-box">
              ${sharedItems.join('')}
            </div>
            <p>Please note: Photo links expire in ${expiresIn} for your privacy and security.</p>
            <p>May Allah bless your journey towards finding a righteous spouse.</p>
          </div>
          <div class="footer">
            <p>At-Tayyibun - Privacy-First Muslim Matrimony</p>
            <p>This email was sent because a user shared their information with you.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await this.sendEmail({
      to: recipientEmail,
      subject: `At-Tayyibun: ${sharedBy} has shared their information with you`,
      html,
    });
  }

  /**
   * Strip HTML tags for plain text version
   */
  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  }
}
