import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';

// Config
import { databaseConfig } from './config/database.config';
import { redisConfig } from './config/redis.config';
import { securityConfig } from './config/security.config';

// Common
import { PrismaModule } from './common/prisma/prisma.module';
import { RedisModule } from './common/redis/redis.module';
import { AuthGuard } from './common/guards/auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { AuditLogInterceptor } from './common/interceptors/audit-log.interceptor';

// Feature Modules
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ProfilesModule } from './modules/profiles/profiles.module';
import { PhotosModule } from './modules/photos/photos.module';
import { RequestsModule } from './modules/requests/requests.module';
import { MessagingModule } from './modules/messaging/messaging.module';
import { AdsModule } from './modules/ads/ads.module';
import { CouponsModule } from './modules/coupons/coupons.module';
import { AdminModule } from './modules/admin/admin.module';
import { AuditModule } from './modules/audit/audit.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, redisConfig, securityConfig],
      envFilePath: ['.env.local', '.env'],
    }),

    // Rate limiting
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000,
        limit: 3,
      },
      {
        name: 'medium',
        ttl: 10000,
        limit: 20,
      },
      {
        name: 'long',
        ttl: 60000,
        limit: 100,
      },
    ]),

    // Infrastructure
    PrismaModule,
    RedisModule,

    // Feature Modules
    AuthModule,
    UsersModule,
    ProfilesModule,
    PhotosModule,
    RequestsModule,
    MessagingModule,
    AdsModule,
    CouponsModule,
    AdminModule,
    AuditModule,
    HealthModule,
  ],
  providers: [
    // Global auth guard (deny-by-default)
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
    // RBAC guard
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    // Audit logging
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditLogInterceptor,
    },
  ],
})
export class AppModule {}
