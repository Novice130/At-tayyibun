import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { FirebaseAuthService } from './firebase-auth.service';

@Module({
  controllers: [AuthController],
  providers: [AuthService, FirebaseAuthService],
  exports: [AuthService, FirebaseAuthService],
})
export class AuthModule {}
