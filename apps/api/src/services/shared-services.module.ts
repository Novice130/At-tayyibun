import { Global, Module } from '@nestjs/common';
import { EncryptionService } from './encryption.service';
import { EmailService } from './email.service';
import { AvatarService } from './avatar.service';
import { AuditService } from './audit.service';

@Global()
@Module({
  providers: [
    EncryptionService,
    EmailService,
    AvatarService,
    AuditService,
  ],
  exports: [
    EncryptionService,
    EmailService,
    AvatarService,
    AuditService,
  ],
})
export class SharedServicesModule {}
