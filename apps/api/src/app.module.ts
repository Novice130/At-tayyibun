import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { ThrottlerModule } from "@nestjs/throttler";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { BullModule } from '@nestjs/bullmq';
// Core modules
import { DrizzleModule } from "./db/drizzle.module";
import { SharedServicesModule } from "./services/shared-services.module";
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

// Guards & Interceptors
import { BetterAuthGuard } from "./common/guards/better-auth.guard";
import { AuditLogInterceptor } from "./common/interceptors/audit-log.interceptor";
import { ThrottlerGuard } from "@nestjs/throttler";

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: process.env.NODE_ENV === "test" ? ".env.test" : ".env",
    }),

    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const raw = configService.get<string>('REDIS_URL') || 'redis://localhost:6379';
        const { hostname, port, password, pathname } = new URL(raw);
        return {
          connection: {
            host: hostname,
            port: parseInt(port, 10) || 6379,
            ...(password && { password: decodeURIComponent(password) }),
            db: parseInt(pathname?.slice(1) || '0', 10) || 0,
            lazyConnect: true,
            maxRetriesPerRequest: null,
            enableOfflineQueue: false,
          },
        };
      },
      inject: [ConfigService],
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
    DrizzleModule,

    // Global shared services (Encryption, Email, Storage, Avatar, Audit)
    SharedServicesModule,

    // Feature modules
    AuthModule,
    UsersModule,
    ProfilesModule,
    RequestsModule,
    PhotosModule,
    AdminModule,
    // MessagesModule,
    // AdsModule,
    // CouponsModule,
    // MembershipsModule,
    // CampaignsModule,
  ],
  providers: [
    // Global guards (deny-by-default)
    {
      provide: APP_GUARD,
      useClass: BetterAuthGuard,
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
})
export class AppModule {}
