import { Module } from '@nestjs/common';
import { ModerationService } from './moderation.service';
import { ModerationController } from './moderation.controller';
import { AdminReportsController } from './admin-reports.controller';

@Module({
  controllers: [ModerationController, AdminReportsController],
  providers: [ModerationService],
  exports: [ModerationService],
})
export class ModerationModule {}
