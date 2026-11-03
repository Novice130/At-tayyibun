import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { and, count, eq, inArray, isNull } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { EmailService, POSTAL_ADDRESS_MISSING } from '../../../services/email.service';
import { DrizzleService } from '../../../db/drizzle.service';
import { campaignRecipients, emailCampaigns, unsubscribes, users } from '../../../db/schema';
import { UnsubscribeService } from '../../unsubscribe/unsubscribe.service';

/**
 * Marks a job as created by the guarded dispatch path. This processor was not
 * registered before, so jobs queued back then may still sit in Redis, written
 * when an admin had no working send and no unsubscribe handling. Those carry no
 * version and must never send just because a deploy started a worker.
 */
export const CAMPAIGN_DISPATCH_VERSION = 2;

export interface CampaignJobData {
  campaignId: string;
  dispatchVersion?: number;
}

type Audience = { roles?: string[]; membershipTiers?: string[] } | null | undefined;

/** Real addresses in the audience, minus everyone unsubscribed or suspended. */
export function campaignRecipientsQuery(db: any, audience: Audience) {
  // Phone-first accounts hold a +<e164>@phone.attayyibun.invalid address until
  // they supply a real one. Sending to .invalid can only produce hard bounces,
  // which is exactly what wrecks a sending domain's reputation.
  const filters: any[] = [eq(users.emailIsPlaceholder, false), isNull(unsubscribes.id), isNull(users.suspendedAt)];
  if (audience?.roles?.length) filters.push(inArray(users.role, audience.roles as any));
  if (audience?.membershipTiers?.length) filters.push(inArray(users.membershipTier, audience.membershipTiers as any));

  return db
    .select({ id: users.id, publicId: users.publicId, email: users.email })
    .from(users)
    .leftJoin(unsubscribes, eq(unsubscribes.userId, users.id))
    .where(and(...filters));
}

@Injectable()
@Processor('email-campaign-queue')
export class EmailCampaignProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailCampaignProcessor.name);

  constructor(
    private readonly emailService: EmailService,
    private readonly drizzle: DrizzleService,
    private readonly unsubscribeService: UnsubscribeService,
  ) {
    super();
  }

  /** Back to DRAFT, so a person has to dispatch it again on purpose. */
  private async returnToDraft(campaignId: string) {
    await this.drizzle.db
      .update(emailCampaigns)
      .set({ status: 'DRAFT' })
      .where(and(eq(emailCampaigns.id, campaignId), eq(emailCampaigns.status, 'SENDING')));
  }

  async process(job: Job<CampaignJobData>): Promise<unknown> {
    const { campaignId, dispatchVersion } = job.data;
    const db = this.drizzle.db;

    if (dispatchVersion !== CAMPAIGN_DISPATCH_VERSION) {
      this.logger.warn(`Discarded pre-guard job ${job.id} for campaign ${campaignId}; nothing was sent.`);
      await this.returnToDraft(campaignId);
      return { skipped: 'legacy-job' };
    }

    const [campaign] = await db.select().from(emailCampaigns).where(eq(emailCampaigns.id, campaignId));
    if (!campaign) {
      this.logger.error(`Campaign ${campaignId} not found`);
      return { skipped: 'not-found' };
    }
    if (campaign.status !== 'SENDING') {
      this.logger.warn(`Campaign ${campaignId} is ${campaign.status}, not SENDING; nothing was sent.`);
      return { skipped: 'not-sending' };
    }
    if (!this.emailService.postalAddress) {
      await this.returnToDraft(campaignId);
      throw new Error(POSTAL_ADDRESS_MISSING);
    }

    // Past this point a throw would leave the campaign SENDING for good, and
    // dispatch only claims DRAFT. Hand it back instead. A re-dispatch cannot
    // double-send: each member's (campaign, user) row is already claimed.
    try {
      const recipients: Array<{ id: string; publicId: string; email: string }> = await campaignRecipientsQuery(
        db,
        campaign.targetAudience as Audience,
      );
      this.logger.log(`Campaign ${campaignId}: ${recipients.length} recipients`);

      for (const recipient of recipients) {
        // The unique (campaign, user) row is claimed before sending, so a stalled
        // job that BullMQ re-runs cannot email anyone twice. At most once: a crash
        // between claim and send loses that one email rather than repeating it.
        const [claim] = await db
          .insert(campaignRecipients)
          .values({ id: randomUUID(), campaignId, userId: recipient.id })
          .onConflictDoNothing()
          .returning({ id: campaignRecipients.id });
        if (!claim) continue;

        try {
          const links = this.unsubscribeService.linksFor(recipient.publicId);
          await this.emailService.sendCampaignEmail({
            to: recipient.email,
            subject: campaign.subject,
            html: campaign.template,
            unsubscribeUrl: links.pageUrl,
            oneClickUrl: links.oneClickUrl,
          });
          await db.update(campaignRecipients).set({ sent: true }).where(eq(campaignRecipients.id, claim.id));
        } catch (err) {
          this.logger.error(`Campaign ${campaignId}: send failed for member ${recipient.publicId}: ${err}`);
        }
      }

      const [sent] = await db
        .select({ value: count() })
        .from(campaignRecipients)
        .where(and(eq(campaignRecipients.campaignId, campaignId), eq(campaignRecipients.sent, true)));
      const sentCount = Number(sent?.value ?? 0);

      await db
        .update(emailCampaigns)
        .set({ status: 'SENT', sentAt: new Date().toISOString(), totalRecipients: recipients.length, sentCount })
        .where(eq(emailCampaigns.id, campaignId));

      this.logger.log(`Campaign ${campaignId} done: ${sentCount}/${recipients.length} sent.`);
      return { successCount: sentCount, total: recipients.length };
    } catch (err) {
      await this.returnToDraft(campaignId).catch((resetErr) =>
        this.logger.error(`Campaign ${campaignId}: could not return to DRAFT: ${resetErr}`),
      );
      throw err;
    }
  }

  /** Without a listener a Redis outage would surface as an unhandled 'error' event. */
  @OnWorkerEvent('error')
  onError(err: Error) {
    this.logger.error(`Campaign worker error: ${err.message}`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<CampaignJobData> | undefined, err: Error) {
    this.logger.error(`Campaign job ${job?.id} failed: ${err.message}`);
  }
}
