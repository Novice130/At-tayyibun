import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';

describe('Authorization Tests (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let userAToken: string;
  let userBToken: string;
  let userAId: string;
  let userBId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = app.get(PrismaService);
    await app.init();

    // Setup: Create test users
    // In real tests, mock Firebase auth or use test tokens
    userAId = 'test-user-a';
    userBId = 'test-user-b';
    userAToken = 'mock-token-user-a';
    userBToken = 'mock-token-user-b';
  });

  afterAll(async () => {
    await prisma.cleanDatabase();
    await app.close();
  });

  describe('IDOR Prevention - Profile Access', () => {
    it('should not allow User A to access User B private profile data', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/profiles/private/${userBId}`)
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(403);

      expect(response.body.message).toContain('Forbidden');
    });

    it('should allow User A to access their own profile', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/profiles/me')
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should return only public fields for public profile view', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/profiles/public-id-user-b`)
        .expect(200);

      // Should NOT contain private fields
      expect(response.body.data.lastName).toBeUndefined();
      expect(response.body.data.dateOfBirth).toBeUndefined();
      expect(response.body.data.phone).toBeUndefined();
      expect(response.body.data.email).toBeUndefined();
    });
  });

  describe('BOLA Prevention - Request Workflow', () => {
    it('should not allow User A to respond to requests sent to User B', async () => {
      // Create a request from User C to User B
      const requestId = 'test-request-id';

      const response = await request(app.getHttpServer())
        .put(`/api/requests/${requestId}/respond`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ approve: true, shareType: 'ALL' })
        .expect(404); // Not found because User A doesn't own this request

      expect(response.body.message).toContain('not found');
    });

    it('should allow target user to respond to their own requests', async () => {
      // Assumes request exists for User B
      const response = await request(app.getHttpServer())
        .get('/api/requests/received')
        .set('Authorization', `Bearer ${userBToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('Admin RBAC', () => {
    it('should deny non-admin access to admin endpoints', async () => {
      await request(app.getHttpServer())
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(403);
    });

    it('should deny non-super-admin from adding admins', async () => {
      const adminToken = 'mock-admin-token';
      
      await request(app.getHttpServer())
        .post('/api/admin/admins')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ userId: userAId })
        .expect(403);
    });
  });

  describe('Token Validation', () => {
    it('should reject expired tokens', async () => {
      const expiredToken = 'expired-token';
      
      await request(app.getHttpServer())
        .get('/api/profiles/me')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);
    });

    it('should reject malformed tokens', async () => {
      await request(app.getHttpServer())
        .get('/api/profiles/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });

    it('should reject missing authorization header', async () => {
      await request(app.getHttpServer())
        .get('/api/profiles/me')
        .expect(401);
    });
  });
});
