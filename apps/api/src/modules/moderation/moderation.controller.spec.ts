import { ExecutionContext } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerException, ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { BLOCK_CREATE_LIMIT, ModerationController } from './moderation.controller';

describe('POST /blocks throttle', () => {
  let guard: ThrottlerGuard;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      // The same throttler names as AppModule. The two the route does not
      // override are set high so that only the block cap can trip.
      imports: [
        ThrottlerModule.forRoot([
          { name: 'short', ttl: 1000, limit: 100000 },
          { name: 'medium', ttl: 10000, limit: 100000 },
          { name: 'long', ttl: 60000, limit: 100000 },
        ]),
      ],
      providers: [ThrottlerGuard],
    }).compile();
    guard = moduleRef.get(ThrottlerGuard);
    await guard.onModuleInit();
  });

  const hit = (userId: string, ip: string) => {
    const request = { user: { id: userId }, ip, ips: [], headers: {} };
    const response = { header: jest.fn(), setHeader: jest.fn() };
    return guard.canActivate({
      getHandler: () => ModerationController.prototype.block,
      getClass: () => ModerationController,
      switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
      getType: () => 'http',
    } as unknown as ExecutionContext);
  };

  it('caps each user, however many addresses they use', async () => {
    for (let i = 0; i < BLOCK_CREATE_LIMIT; i++) {
      await expect(hit('user-a', `10.0.0.${i % 250}`)).resolves.toBe(true);
    }
    await expect(hit('user-a', '10.9.9.9')).rejects.toBeInstanceOf(ThrottlerException);
  });

  it('does not charge one user for another behind the same address', async () => {
    for (let i = 0; i < BLOCK_CREATE_LIMIT; i++) await hit('user-a', '10.0.0.1');
    await expect(hit('user-b', '10.0.0.1')).resolves.toBe(true);
  });
});
