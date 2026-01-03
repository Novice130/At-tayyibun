import { Module } from '@nestjs/common';
import { ProfilesController } from './profiles.controller';
import { ProfilesService } from './profiles.service';
import { EncryptionService } from './encryption.service';

@Module({
  controllers: [ProfilesController],
  providers: [ProfilesService, EncryptionService],
  exports: [ProfilesService, EncryptionService],
})
export class ProfilesModule {}
