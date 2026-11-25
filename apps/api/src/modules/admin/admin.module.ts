import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { ModerationModule } from '../moderation/moderation.module';
import { AdminAdsController } from './controllers/admin-ads.controller';
import { AdminAdsService } from './services/admin-ads.service';
import { AdminCouponsController } from './controllers/admin-coupons.controller';
import { AdminCouponsService } from './services/admin-coupons.service';
import { AdminCampaignsController } from './controllers/admin-campaigns.controller';
import { AdminCampaignsService } from './services/admin-campaigns.service';
import { AdminSchemasController } from './controllers/admin-schemas.controller';
import { AdminSchemasService } from './services/admin-schemas.service';
import { EmailCampaignProcessor } from './processors/email-campaign.processor';
import { UnsubscribeModule } from '../unsubscribe/unsubscribe.module';

@Module({
  imports: [
    ModerationModule,
    BullModule.registerQueue({ name: 'email-campaign-queue' }),
    UnsubscribeModule,
  ],
  controllers: [
    AdminController,
    AdminAdsController,
    AdminCouponsController,
    AdminCampaignsController,
    AdminSchemasController,
  ],
  providers: [
    AdminService,
    AdminAdsService,
    AdminCouponsService,
    AdminCampaignsService,
    AdminSchemasService,
    EmailCampaignProcessor,
  ],
  exports: [AdminService],
})
export class AdminModule {}
