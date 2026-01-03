import { registerAs } from '@nestjs/config';

export const securityConfig = registerAs('security', () => ({
  // Encryption
  encryptionKey: process.env.ENCRYPTION_KEY,
  encryptionKeyId: process.env.ENCRYPTION_KEY_ID || 'v1',

  // JWT
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',

  // Firebase
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  },

  // GCS
  gcs: {
    bucketPhotos: process.env.GCS_BUCKET_NAME || 'at-tayyibun-photos',
    bucketAvatars: process.env.GCS_BUCKET_AVATARS || 'at-tayyibun-avatars',
  },

  // Rate limits
  rateLimits: {
    login: {
      max: parseInt(process.env.RATE_LIMIT_LOGIN_MAX || '5', 10),
      windowMs: parseInt(process.env.RATE_LIMIT_LOGIN_WINDOW_MS || '60000', 10),
    },
    signup: {
      max: parseInt(process.env.RATE_LIMIT_SIGNUP_MAX || '3', 10),
      windowMs: parseInt(process.env.RATE_LIMIT_SIGNUP_WINDOW_MS || '60000', 10),
    },
    browse: {
      max: parseInt(process.env.RATE_LIMIT_BROWSE_MAX || '100', 10),
      windowMs: parseInt(process.env.RATE_LIMIT_BROWSE_WINDOW_MS || '60000', 10),
    },
    infoRequest: {
      max: 10,
      windowMs: 3600000, // 1 hour
    },
  },

  // SendGrid
  sendgrid: {
    apiKey: process.env.SENDGRID_API_KEY,
    fromEmail: process.env.SENDGRID_FROM_EMAIL || 'noreply@at-tayyibun.com',
    fromName: process.env.SENDGRID_FROM_NAME || 'At-Tayyibun',
  },
}));
