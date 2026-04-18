import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { EmailService } from '../../../services/email.service';
import { DrizzleService } from '../../../db/drizzle.service';
import { emailCampaigns, users } from '../../../db/schema';
import { eq, inArray, and } from 'drizzle-orm';

@Injectable()
@Processor('email-campaign-queue')
export class EmailCampaignProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailCampaignProcessor.name);

  constructor(
    private readonly emailService: EmailService,
    private readonly drizzle: DrizzleService,
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    const { campaignId, subject, audience } = job.data;
    this.logger.log(`Processing email campaign job: ${campaignId}`);
    
    const db = this.drizzle.db;

    // Fetch campaign template
    const [campaign] = await db.select().from(emailCampaigns).where(eq(emailCampaigns.id, campaignId));
    if (!campaign) {
      this.logger.error(`Campaign ${campaignId} not found`);
      return;
    }

    // Build filters
    const filters: any[] = [];
    if (audience?.roles?.length > 0) {
      filters.push(inArray(users.role, audience.roles));
    }
    if (audience?.membershipTiers?.length > 0) {
      filters.push(inArray(users.membershipTier, audience.membershipTiers));
    }

    // Fetch users
    const recipients = await db.select({ 
      email: users.email, 
      name: users.name,
      firstName: users.name // Fallback if name is used as first name
    })
    .from(users)
    .where(filters.length > 0 ? and(...filters) : undefined);

    this.logger.log(`Found ${recipients.length} recipients for campaign ${campaignId}`);
    
    let successCount = 0;
    for (const recipient of recipients) {
      try {
        await this.emailService.sendEmail({
          to: recipient.email,
          subject: subject,
          html: campaign.template
        });
        successCount++;
        
        // Update sent count periodically or at end
      } catch (err) {
        this.logger.error(`Failed to send email to ${recipient.email}: ${err}`);
      }
    }

    // Mark as SENT in DB
    await db.update(emailCampaigns)
      .set({ 
        status: 'SENT', 
        sentAt: new Date().toISOString(),
        totalRecipients: recipients.length,
        sentCount: successCount
      })
      .where(eq(emailCampaigns.id, campaignId));

    this.logger.log(`Completed email campaign ${campaignId}. Sent ${successCount}/${recipients.length} emails.`);
    return { successCount, total: recipients.length };
  }
}
