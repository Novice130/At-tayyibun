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

    // Rate limiting (global defaults).
    //
    // These are per-IP. The previous "short" bucket of 3/second was below what
    // a single legitimate page load needs — /browse alone issues /profiles/me,
    // /profiles and /requests/active in parallel, plus the navbar's request
    // count — so normal navigation could 429 itself. It is also shared across
    // everyone behind one NAT. Abuse control for the sensitive operations lives
    // on the endpoints themselves (e.g. POST /requests is @Throttle 10/hour).
    ThrottlerModule.forRoot([
      {
        name: "short",
        ttl: 1000,
        limit: 20,
      },
      {
        name: "medium",
        ttl: 10000,
        limit: 100,
      },
      {
        name: "long",
        ttl: 60000,
        limit: 300,
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
