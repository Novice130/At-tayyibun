import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import * as cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  try {
    const app = await NestFactory.create(AppModule, {
      logger: ['error', 'warn', 'log'],
    });

    // Parse cookies (required for BetterAuth session tokens)
    app.use(cookieParser());

    const configService = app.get(ConfigService);
    const port = configService.get<number>('API_PORT', 3001);
    const webUrl = configService.get<string>('WEB_URL', 'http://localhost:3000');

    // Security headers
    app.use(
      helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", 'data:', 'https:'],
            scriptSrc: ["'self'"],
          },
        },
        hsts: {
          maxAge: 31536000,
          includeSubDomains: true,
          preload: true,
        },
      }),
    );

    // CORS. The web app is the only allowed browser origin; native clients
    // (Flutter) send no Origin header and are unaffected. Any other browser
    // origin is refused before credentials are ever considered.
    const allowedOrigins = [webUrl];
    app.enableCors({
      origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
    });

    // Global validation pipe
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    );

    // Global exception filter
    app.useGlobalFilters(new AllExceptionsFilter());

    // API prefix
    app.setGlobalPrefix('api');

    // Swagger documentation. Disabled in production: it enumerates the full
    // API surface without authentication.
    if (configService.get<string>('NODE_ENV') !== 'production') {
      const swaggerConfig = new DocumentBuilder()
        .setTitle('At-Tayyibun API')
        .setDescription('Privacy-first Muslim Matrimony Platform API')
        .setVersion('1.0')
        .addBearerAuth()
        .build();

      const document = SwaggerModule.createDocument(app, swaggerConfig);
      SwaggerModule.setup('api/docs', app, document);
      console.log(`📚 Swagger docs at http://localhost:${port}/api/docs`);
    }

    await app.listen(port, '0.0.0.0');
    console.log(`🚀 API running on http://localhost:${port}`);
  } catch (err) {
    console.error('❌ FATAL STARTUP ERROR:', err);
    process.exit(1);
  }
}

bootstrap();
