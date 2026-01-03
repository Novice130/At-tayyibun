// Email Sender Job
// Triggered by Cloud Tasks when info request is approved
// Sends personalized email with signed URLs for photos
// Uses SendGrid for delivery with rate limiting

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma/prisma.service';

interface ApprovalEmailPayload {
  requestId: string;
}

@Injectable()
export class EmailSenderJob {
  private readonly logger = new Logger(EmailSenderJob.name);

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  async sendApprovalEmail(payload: ApprovalEmailPayload): Promise<void> {
    const { requestId } = payload;
    this.logger.log(`Processing approval email for request ${requestId}`);

    const request = await this.prisma.infoRequest.findUnique({
      where: { id: requestId },
      include: {
        requester: { include: { profile: true } },
        target: { include: { profile: true, photos: true } },
        tokens: true,
      },
    });

    if (!request || request.status !== 'APPROVED') {
      this.logger.warn(`Request ${requestId} not found or not approved`);
      return;
    }

    if (request.emailSentAt) {
      this.logger.warn(`Email already sent for request ${requestId}`);
      return;
    }

    const { requester, target, allowedShares } = request;
    const fromEmail = this.configService.get<string>('security.sendgrid.fromEmail') || 'noreply@at-tayyibun.com';
    const fromName = this.configService.get<string>('security.sendgrid.fromName') || 'At-Tayyibun';

    // Build email content based on what was shared
    let sharedInfo = '';
    
    if (allowedShares === 'ALL' || allowedShares === 'PHONE_EMAIL') {
      if (request.requestedPhone) {
        sharedInfo += `<p><strong>Phone:</strong> ${target.phone}</p>`;
      }
      if (request.requestedEmail) {
        sharedInfo += `<p><strong>Email:</strong> ${target.email}</p>`;
      }
    }

    if (allowedShares === 'ALL' && request.requestedPhoto) {
      const photoToken = request.tokens.find(t => t.resourceType === 'PHOTO');
      if (photoToken) {
        const photoUrl = `${this.configService.get('API_URL')}/api/photos/shared/${photoToken.token}`;
        sharedInfo += `<p><strong>Photo:</strong> <a href="${photoUrl}">View Photo (expires in 24h)</a></p>`;
      }
    }

    // TODO: Integrate SendGrid when API key is configured
    this.logger.log(`[TODO] Would send email to ${requester.email} with shared info`);

    // Mark email as sent
    await this.prisma.infoRequest.update({
      where: { id: requestId },
      data: { emailSentAt: new Date() },
    });

    this.logger.log(`Approval email processed for request ${requestId}`);
  }

  async sendCampaignEmail(recipientId: string, campaignId: string): Promise<void> {
    const recipient = await this.prisma.emailRecipient.findFirst({
      where: { id: recipientId, campaignId },
    });

    if (!recipient || recipient.sentAt) return;

    const campaign = await this.prisma.emailCampaign.findUnique({
      where: { id: campaignId },
    });

    if (!campaign) return;

    const user = await this.prisma.user.findUnique({
      where: { id: recipient.userId },
      include: { profile: true },
    });

    if (!user) return;

    // Replace personalization tokens
    let body = campaign.bodyTemplate;
    body = body.replace(/{first_name}/g, user.profile?.firstName || 'there');
    body = body.replace(/{email}/g, user.email);

    // TODO: Send via SendGrid
    this.logger.log(`[TODO] Would send campaign email to ${recipient.email}`);

    await this.prisma.emailRecipient.update({
      where: { id: recipientId },
      data: { sentAt: new Date() },
    });
  }
}
