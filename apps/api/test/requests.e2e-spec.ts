import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { RedisService } from '../src/common/redis/redis.service';

describe('Request Workflow Tests (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let redis: RedisService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = app.get(PrismaService);
    redis = app.get(RedisService);
    await app.init();
  });

  afterAll(async () => {
    await prisma.cleanDatabase();
    await app.close();
  });

  beforeEach(async () => {
    // Clear Redis locks before each test
    await redis.del('active_request:*');
  });

  describe('One Active Request Per User', () => {
    const requesterToken = 'mock-requester-token';
    const targetPublicId = 'target-public-id';

    it('should allow first request', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/requests')
        .set('Authorization', `Bearer ${requesterToken}`)
        .send({
          targetPublicId,
          requestPhoto: true,
          requestPhone: true,
          requestEmail: true,
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.requestId).toBeDefined();
    });

    it('should reject second request while first is pending', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/requests')
        .set('Authorization', `Bearer ${requesterToken}`)
        .send({
          targetPublicId: 'another-target',
          requestPhoto: true,
          requestPhone: true,
          requestEmail: true,
        })
        .expect(409);

      expect(response.body.message).toContain('already have an active request');
    });

    it('should allow new request after first is responded to', async () => {
      // Respond to the pending request
      const pendingRequest = await prisma.infoRequest.findFirst({
        where: { status: 'PENDING' },
      });

      await request(app.getHttpServer())
        .put(`/api/requests/${pendingRequest?.id}/respond`)
        .set('Authorization', 'Bearer target-token')
        .send({ approve: false })
        .expect(200);

      // Now should be able to create new request
      const response = await request(app.getHttpServer())
        .post('/api/requests')
        .set('Authorization', `Bearer ${requesterToken}`)
        .send({
          targetPublicId: 'another-target',
          requestPhoto: true,
          requestPhone: true,
          requestEmail: true,
        })
        .expect(201);

      expect(response.body.success).toBe(true);
    });
  });

  describe('Request Expiration', () => {
    it('should create request with 24h expiry', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/requests')
        .set('Authorization', 'Bearer new-user-token')
        .send({
          targetPublicId: 'target-123',
          requestPhoto: true,
          requestPhone: true,
          requestEmail: true,
        })
        .expect(201);

      const createdRequest = await prisma.infoRequest.findUnique({
        where: { id: response.body.data.requestId },
      });

      // Verify expiry is ~24 hours from now
      const expectedExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const actualExpiry = new Date(createdRequest!.expiresAt);
      const diffMinutes = Math.abs(expectedExpiry.getTime() - actualExpiry.getTime()) / 60000;

      expect(diffMinutes).toBeLessThan(5); // Within 5 minutes tolerance
    });

    it('should reject response to expired request', async () => {
      // Create an expired request
      const expiredRequest = await prisma.infoRequest.create({
        data: {
          requesterId: 'user-1',
          targetId: 'user-2',
          expiresAt: new Date(Date.now() - 1000), // Expired
          status: 'PENDING',
        },
      });

      const response = await request(app.getHttpServer())
        .put(`/api/requests/${expiredRequest.id}/respond`)
        .set('Authorization', 'Bearer user-2-token')
        .send({ approve: true, shareType: 'ALL' })
        .expect(400);

      expect(response.body.message).toContain('expired');
    });
  });

  describe('Cannot Request Self', () => {
    it('should reject self-request', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/requests')
        .set('Authorization', 'Bearer self-user-token')
        .send({
          targetPublicId: 'self-public-id',
          requestPhoto: true,
        })
        .expect(400);

      expect(response.body.message).toContain('own information');
    });
  });

  describe('Approval Workflow', () => {
    it('should update status on approval', async () => {
      // Create a pending request
      const pendingRequest = await prisma.infoRequest.create({
        data: {
          requesterId: 'requester-id',
          targetId: 'target-id',
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          status: 'PENDING',
        },
      });

      const response = await request(app.getHttpServer())
        .put(`/api/requests/${pendingRequest.id}/respond`)
        .set('Authorization', 'Bearer target-token')
        .send({ approve: true, shareType: 'ALL' })
        .expect(200);

      expect(response.body.data.status).toBe('APPROVED');

      // Verify in database
      const updatedRequest = await prisma.infoRequest.findUnique({
        where: { id: pendingRequest.id },
      });
      expect(updatedRequest?.status).toBe('APPROVED');
      expect(updatedRequest?.allowedShares).toBe('ALL');
    });

    it('should support partial sharing (phone + email only)', async () => {
      const pendingRequest = await prisma.infoRequest.create({
        data: {
          requesterId: 'requester-id-2',
          targetId: 'target-id-2',
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          status: 'PENDING',
        },
      });

      const response = await request(app.getHttpServer())
        .put(`/api/requests/${pendingRequest.id}/respond`)
        .set('Authorization', 'Bearer target-token-2')
        .send({ approve: true, shareType: 'PHONE_EMAIL' })
        .expect(200);

      expect(response.body.data.status).toBe('APPROVED');

      const updatedRequest = await prisma.infoRequest.findUnique({
        where: { id: pendingRequest.id },
      });
      expect(updatedRequest?.allowedShares).toBe('PHONE_EMAIL');
    });
  });
});
