import { Module } from '@nestjs/common';
import { DevicesController } from './devices.controller';
import { DevicesService } from './devices.service';
import { PushService } from './push.service';

@Module({
  controllers: [DevicesController],
  providers: [DevicesService, PushService],
  exports: [PushService],
})
export class NotificationsModule {}
