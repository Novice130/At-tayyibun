import { ArgumentMetadata, ExecutionContext, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerException, ThrottlerModule } from '@nestjs/throttler';
import { DEVICE_WRITE_LIMIT, DevicesController } from './devices.controller';
import { DevicesService } from './devices.service';
import { RegisterDeviceDto, UnregisterDeviceDto } from './dto';
import { AppThrottlerGuard } from '../../common/guards/app-throttler.guard';

describe('DevicesController', () => {
  const service = {
    register: jest.fn(async () => ({ success: true })),
    unregister: jest.fn(async () => ({ success: true })),
  };
  const controller = new DevicesController(service as unknown as DevicesService);

  beforeEach(() => jest.clearAllMocks());

  it('registers the token for the signed-in member', async () => {
    await expect(controller.register({ token: 'tok', platform: 'ios' }, 'user-1')).resolves.toEqual({ success: true });
    expect(service.register).toHaveBeenCalledWith('user-1', 'tok', 'ios');
  });

  it('unregisters the token for the signed-in member', async () => {
    await controller.unregister({ token: 'tok' }, 'user-1');
    expect(service.unregister).toHaveBeenCalledWith('user-1', 'tok');
  });

  describe('validation (the app-wide ValidationPipe options)', () => {
    const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
    const body = (metatype: ArgumentMetadata['metatype']): ArgumentMetadata => ({ type: 'body', metatype });

    it('accepts android and ios', async () => {
      for (const platform of ['android', 'ios']) {
        await expect(pipe.transform({ token: 'tok', platform }, body(RegisterDeviceDto))).resolves.toBeDefined();
      }
    });

    it.each([
      [{ token: 'tok', platform: 'web' }],
      [{ token: '', platform: 'ios' }],
      [{ platform: 'ios' }],
      [{ token: 'x'.repeat(4097), platform: 'ios' }],
      [{ token: 'tok', platform: 'ios', userId: 'someone-else' }],
    ])('rejects %j', async (payload) => {
      await expect(pipe.transform(payload, body(RegisterDeviceDto))).rejects.toBeDefined();
    });

    it('requires a token to unregister', async () => {
      await expect(pipe.transform({}, body(UnregisterDeviceDto))).rejects.toBeDefined();
    });
  });

  describe('throttle', () => {
    let guard: AppThrottlerGuard;
    let close: () => Promise<void>;

    // Closing the module stops the throttler storage's expiry timers, which
    // otherwise keep the jest worker alive.
    afterEach(() => close());

    beforeEach(async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [
          ThrottlerModule.forRoot([
            { name: 'short', ttl: 1000, limit: 100000 },
            { name: 'medium', ttl: 10000, limit: 100000 },
            { name: 'long', ttl: 60000, limit: 100000 },
          ]),
        ],
        providers: [AppThrottlerGuard],
      }).compile();
      close = () => moduleRef.close();
      guard = moduleRef.get(AppThrottlerGuard);
      await guard.onModuleInit();
    });

    const hit = (userId: string) => {
      const request = { user: { id: userId }, ip: '10.0.0.1', ips: [], headers: {} };
      const response = { header: jest.fn(), setHeader: jest.fn() };
      return guard.canActivate({
        getHandler: () => DevicesController.prototype.register,
        getClass: () => DevicesController,
        switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
        getType: () => 'http',
      } as unknown as ExecutionContext);
    };

    it('caps registrations per member per hour', async () => {
      for (let i = 0; i < DEVICE_WRITE_LIMIT; i++) await expect(hit('user-a')).resolves.toBe(true);
      await expect(hit('user-a')).rejects.toBeInstanceOf(ThrottlerException);
      await expect(hit('user-b')).resolves.toBe(true);
    });
  });
});
