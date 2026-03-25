import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersModule } from '../users/users.module';
import { AuditService } from '../../services/audit.service';
import { EncryptionService } from '../../services/encryption.service';

@Module({
  imports: [
    ConfigModule,
    UsersModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, AuditService, EncryptionService],
  exports: [AuthService],
})
export class AuthModule {}

