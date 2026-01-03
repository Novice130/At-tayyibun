import { Module } from '@nestjs/common';
import { JobsController } from './jobs.controller';
import { RequestExpiryJob } from './request-expiry.job';
import { GoldBoostJob } from './gold-boost.job';
import { EmailSenderJob } from './email-sender.job';
import { ImageProcessorJob } from './image-processor.job';

@Module({
  controllers: [JobsController],
  providers: [RequestExpiryJob, GoldBoostJob, EmailSenderJob, ImageProcessorJob],
  exports: [RequestExpiryJob, GoldBoostJob, EmailSenderJob, ImageProcessorJob],
})
export class JobsModule {}
