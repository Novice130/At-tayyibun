import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerModule } from "@nestjs/throttler";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
// Core modules
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./modules/auth/auth.module";
import { UsersModule } from "./modules/users/users.module";
import { ProfilesModule } from "./modules/profiles/profiles.module";
import { PhotosModule } from "./modules/photos/photos.module";
import { RequestsModule } from "./modules/requests/requests.module";
import { AdminModule } from "./modules/admin/admin.module";
// Stubs for missing modules
import {
  MessagesModule,
  AdsModule,
  CouponsModule,
  MembershipsModule,
  CampaignsModule,
} from "./modules/stub-modules";

// Services
import { EncryptionService } from "./services/encryption.service";
import { EmailService } from "./services/email.service";
import { StorageService } from "./services/storage.service";
import { AvatarService } from "./services/avatar.service";
import { AuditService } from "./services/audit.service";

// Guards & Interceptors
import { JwtAuthGuard } from "./common/guards/jwt-auth.guard";
import { AuditLogInterceptor } from "./common/interceptors/audit-log.interceptor";
import { ThrottlerGuard } from "@nestjs/throttler";

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: process.env.NODE_ENV === "test" ? ".env.test" : ".env",
    }),

    // Rate limiting (global defaults)
    ThrottlerModule.forRoot([
      {
        name: "short",
        ttl: 1000,
        limit: 3,
      },
      {
        name: "medium",
        ttl: 10000,
        limit: 20,
      },
      {
        name: "long",
        ttl: 60000,
        limit: 100,
      },
    ]),

    // Database
    PrismaModule,

    // Feature modules
    AuthModule,
    UsersModule,
    // ProfilesModule,
    // PhotosModule,
    // RequestsModule,
    // MessagesModule,
    // AdsModule,
    // CouponsModule,
    // MembershipsModule,
    // AdminModule,
    // CampaignsModule,
  ],
  providers: [
    // Global services
    EncryptionService,
    EmailService,
    StorageService,
    AvatarService,
    AuditService,

    // Global guards (deny-by-default)
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },

    // Global interceptors
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditLogInterceptor,
    },
  ],
  exports: [
    EncryptionService,
    EmailService,
    StorageService,
    AvatarService,
    AuditService,
  ],
})
export class AppModule {}
