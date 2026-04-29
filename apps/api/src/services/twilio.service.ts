import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TwilioService {
  private readonly logger = new Logger(TwilioService.name);

  constructor(private readonly configService: ConfigService) {}

  private get basicAuth(): string {
    const sid = this.configService.get<string>('TWILIO_API_KEY_SID');
    const secret = this.configService.get<string>('TWILIO_API_KEY_SECRET');
    if (!sid || !secret) {
      throw new Error('TWILIO_API_KEY_SID or TWILIO_API_KEY_SECRET not configured');
    }
    return Buffer.from(`${sid}:${secret}`).toString('base64');
  }

  private get serviceSid(): string {
    const v = this.configService.get<string>('TWILIO_VERIFY_SERVICE_SID');
    if (!v) throw new Error('TWILIO_VERIFY_SERVICE_SID not configured');
    return v;
  }

  async sendVerification(phoneE164: string): Promise<void> {
    const body = new URLSearchParams({ To: phoneE164, Channel: 'sms' });
    const res = await fetch(
      `https://verify.twilio.com/v2/Services/${this.serviceSid}/Verifications`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${this.basicAuth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
      },
    );
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      this.logger.error(`Twilio send ${res.status}: ${text}`);
      throw new Error(`Twilio send failed (${res.status})`);
    }
  }

  async checkVerification(phoneE164: string, code: string): Promise<boolean> {
    const body = new URLSearchParams({ To: phoneE164, Code: code });
    const res = await fetch(
      `https://verify.twilio.com/v2/Services/${this.serviceSid}/VerificationCheck`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${this.basicAuth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
      },
    );
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      this.logger.error(`Twilio verify ${res.status}: ${text}`);
      throw new Error(`Twilio verify failed (${res.status})`);
    }
    const data = (await res.json()) as { status?: string };
    return data.status === 'approved';
  }
}
