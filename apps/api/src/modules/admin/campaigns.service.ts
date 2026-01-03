import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Gender, MembershipTier } from '@prisma/client';

@Injectable()
export class CampaignsService {
  constructor(private prisma: PrismaService) {}

  async createCampaign(data: {
    name: string;
    subject: string;
    bodyTemplate: string;
    targetGender?: Gender;
    targetTier?: MembershipTier;
    scheduledAt?: Date;
    createdById: string;
  }) {
    return this.prisma.emailCampaign.create({ data });
  }

  async getCampaign(id: string) {
    return this.prisma.emailCampaign.findUnique({
      where: { id },
      include: { recipients: true },
    });
  }

  async listCampaigns() {
    return this.prisma.emailCampaign.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async sendCampaign(campaignId: string) {
    const campaign = await this.prisma.emailCampaign.findUnique({ where: { id: campaignId } });
    if (!campaign) return null;

    // Get target users
    const where: any = { isActive: true };
    if (campaign.targetGender) where.profile = { gender: campaign.targetGender };
    if (campaign.targetTier) where.membershipTier = campaign.targetTier;

    const users = await this.prisma.user.findMany({
      where,
      include: { profile: true, emailUnsubscribes: true },
    });

    // Filter out unsubscribed users
    const recipients = users.filter(u => u.emailUnsubscribes.length === 0);

    // Create recipient records
    await this.prisma.emailRecipient.createMany({
      data: recipients.map(u => ({
        campaignId,
        userId: u.id,
        email: u.email,
      })),
      skipDuplicates: true,
    });

    // Update campaign as sent
    await this.prisma.emailCampaign.update({
      where: { id: campaignId },
      data: { sentAt: new Date(), sentCount: recipients.length },
    });

    // TODO: Trigger Cloud Tasks job for actual email sending with rate limiting
    console.log(`[TODO] Queue ${recipients.length} emails for campaign ${campaignId}`);

    return { recipientCount: recipients.length };
  }
}
