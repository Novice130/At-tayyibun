import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, count } from 'drizzle-orm';
import { DrizzleService } from '../../../db/drizzle.service';
import { emailCampaigns } from '../../../db/schema';
import { AuditService } from '../../../services/audit.service';
import { randomUUID } from 'crypto';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { EmailService, POSTAL_ADDRESS_MISSING } from '../../../services/email.service';
import { CAMPAIGN_DISPATCH_VERSION } from '../processors/email-campaign.processor';

@Injectable()
export class AdminCampaignsService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly auditService: AuditService,
    @InjectQueue('email-campaign-queue') private readonly campaignQueue: Queue,
    private readonly emailService: EmailService,
  ) {}

  async getCampaigns(page = 1, limit = 20) {
    const db = this.drizzle.db;
    
    const [metaRow] = await db.select({ value: count() }).from(emailCampaigns);

    const data = await db.select()
      .from(emailCampaigns)
      .limit(limit)
      .offset((page - 1) * limit)
      .orderBy(desc(emailCampaigns.scheduledAt));

    return {
      data,
      meta: {
        total: Number(metaRow.value),
        page,
        limit,
        pages: Math.ceil(Number(metaRow.value) / limit),
      }
    };
  }

  async createCampaign(adminId: string, payload: any) {
    const db = this.drizzle.db;
    const newId = randomUUID();

    await db.insert(emailCampaigns).values({
      id: newId,
      createdById: adminId,
      name: payload.name,
      subject: payload.subject,
      template: payload.template || '',
      status: 'DRAFT',
      scheduledAt: payload.scheduledAt || new Date().toISOString(),
      targetAudience: payload.targetAudience || {},
    });

    await this.auditService.logAdminAction(adminId, 'CREATE_CAMPAIGN', 'email_campaign', newId);
    return { success: true, id: newId };
  }

  async dispatchCampaign(adminId: string, id: string) {
    if (!this.emailService.postalAddress) throw new BadRequestException(POSTAL_ADDRESS_MISSING);

    const db = this.drizzle.db;

    // Only the UPDATE that still finds DRAFT may queue, so a double click or a
    // second admin cannot send a campaign twice.
    const [claimed] = await db.update(emailCampaigns)
      .set({ status: 'SENDING' })
      .where(and(eq(emailCampaigns.id, id), eq(emailCampaigns.status, 'DRAFT')))
      .returning({ id: emailCampaigns.id });
    if (!claimed) {
      const [campaign] = await db.select().from(emailCampaigns).where(eq(emailCampaigns.id, id));
      if (!campaign) throw new NotFoundException('Campaign not found');
      throw new BadRequestException(`This campaign is already ${campaign.status}.`);
    }

    try {
      await this.campaignQueue.add(
        'send-emails',
        { campaignId: id, dispatchVersion: CAMPAIGN_DISPATCH_VERSION },
        { removeOnComplete: 100, removeOnFail: 500 },
      );
    } catch (err) {
      await db.update(emailCampaigns)
        .set({ status: 'DRAFT' })
        .where(and(eq(emailCampaigns.id, id), eq(emailCampaigns.status, 'SENDING')));
      throw err;
    }

    await this.auditService.logAdminAction(adminId, 'DISPATCH_CAMPAIGN', 'email_campaign', id);
    return { success: true, message: 'Campaign queued for dispatch' };
  }

  async deleteCampaign(adminId: string, id: string) {
    const db = this.drizzle.db;
    
    const [campaign] = await db.select().from(emailCampaigns).where(eq(emailCampaigns.id, id));
    if (!campaign) throw new NotFoundException('Campaign not found');

    await db.delete(emailCampaigns).where(eq(emailCampaigns.id, id));
    await this.auditService.logAdminAction(adminId, 'DELETE_CAMPAIGN', 'email_campaign', id);
    return { success: true };
  }
}
