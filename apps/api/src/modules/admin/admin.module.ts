import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminPhotosController } from './controllers/admin-photos.controller';
import { AdminPhotosService } from './services/admin-photos.service';
import { AdminAdsController } from './controllers/admin-ads.controller';
import { AdminAdsService } from './services/admin-ads.service';
import { AdminCouponsController } from './controllers/admin-coupons.controller';
import { AdminCouponsService } from './services/admin-coupons.service';
import { AdminCampaignsController } from './controllers/admin-campaigns.controller';
import { AdminCampaignsService } from './services/admin-campaigns.service';
import { AdminSchemasController } from './controllers/admin-schemas.controller';
import { AdminSchemasService } from './services/admin-schemas.service';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'email-campaign-queue' }),
  ],
  controllers: [
    AdminController,
    AdminPhotosController,
    AdminAdsController,
    AdminCouponsController,
    AdminCampaignsController,
    AdminSchemasController,
  ],
  providers: [
    AdminService,
    AdminPhotosService,
    AdminAdsService,
    AdminCouponsService,
    AdminCampaignsService,
    AdminSchemasService,
  ],
  exports: [AdminService],
})
export class AdminModule {}
