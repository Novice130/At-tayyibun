import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const mockSendEachForMulticast = jest.fn();
const mockInitializeApp = jest.fn((_opts: unknown, name: string) => ({ name }));
const mockGetApps = jest.fn((): { name: string }[] => []);
const mockCert = jest.fn((c: unknown) => c);

jest.mock('firebase-admin/app', () => ({
  initializeApp: (opts: unknown, name: string) => mockInitializeApp(opts, name),
  getApps: () => mockGetApps(),
  cert: (c: unknown) => mockCert(c),
}));
jest.mock('firebase-admin/messaging', () => ({
  getMessaging: () => ({ sendEachForMulticast: mockSendEachForMulticast }),
}));

import { PUSH_MESSAGES, PushService } from './push.service';
import { DevicesService } from './devices.service';

// A fake key. Built from parts so secret scanners do not flag a PEM block.
const PEM_BEGIN = ['-----BEGIN', 'PRIVATE KEY-----'].join(' ');
const PEM_END = ['-----END', 'PRIVATE KEY-----'].join(' ');
const FAKE_PEM = `${PEM_BEGIN}\nabc\n${PEM_END}\n`;

const CREDS = {
  FIREBASE_PROJECT_ID: 'demo-project',
  FIREBASE_CLIENT_EMAIL: 'push@demo-project.iam.gserviceaccount.com',
  FIREBASE_PRIVATE_KEY: `"${FAKE_PEM.replace(/\n/g, '\\n')}"`,
};

function config(env: Record<string, string>) {
  return { get: (key: string) => env[key] } as unknown as ConfigService;
}

describe('PushService', () => {
  let devices: { tokensFor: jest.Mock; removeTokens: jest.Mock };
  let warn: jest.SpyInstance;
  let error: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    devices = {
      tokensFor: jest.fn(async () => ['tok-a', 'tok-b']),
      removeTokens: jest.fn(async () => undefined),
    };
    mockSendEachForMulticast.mockResolvedValue({
      successCount: 2,
      failureCount: 0,
      responses: [{ success: true }, { success: true }],
    });
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  const make = (env: Record<string, string> = CREDS) =>
    new PushService(config(env), devices as unknown as DevicesService);

  it('is a no-op without credentials', async () => {
    const push = make({});
    await expect(push.send('user-1', 'REQUEST_RECEIVED')).resolves.toBe(0);
    expect(mockInitializeApp).not.toHaveBeenCalled();
    expect(devices.tokensFor).not.toHaveBeenCalled();
    expect(mockSendEachForMulticast).not.toHaveBeenCalled();
  });

  it('sends a generic message with the deep-link path to every device', async () => {
    const push = make();
    await expect(push.send('user-1', 'REQUEST_RECEIVED')).resolves.toBe(2);
    expect(devices.tokensFor).toHaveBeenCalledWith('user-1');
    expect(mockSendEachForMulticast).toHaveBeenCalledWith(
      expect.objectContaining({
        tokens: ['tok-a', 'tok-b'],
        notification: { title: 'You have a new request', body: expect.any(String) },
        data: { path: '/requests' },
      }),
    );
  });

  it('turns literal \\n in the private key into newlines and strips quotes', async () => {
    await make().send('user-1', 'REQUEST_APPROVED');
    const creds = mockCert.mock.calls[0][0] as { privateKey: string; projectId: string };
    expect(creds.projectId).toBe('demo-project');
    expect(creds.privateKey).toBe(FAKE_PEM);
  });

  it('reuses an already initialised app', async () => {
    mockGetApps.mockReturnValueOnce([{ name: 'attayyibun-push' }]);
    await make().send('user-1', 'REQUEST_APPROVED');
    expect(mockInitializeApp).not.toHaveBeenCalled();
  });

  it('carries no personal data in any message', () => {
    for (const msg of Object.values(PUSH_MESSAGES)) {
      expect(msg.title + msg.body).not.toMatch(/@|\+?\d{3}/);
      expect(msg.path).toMatch(/^\/(requests|profiles\/[^/]+)$/);
    }
  });

  it('skips the send when the member has no devices', async () => {
    devices.tokensFor.mockResolvedValueOnce([]);
    await expect(make().send('user-1', 'REQUEST_RECEIVED')).resolves.toBe(0);
    expect(mockSendEachForMulticast).not.toHaveBeenCalled();
  });

  it('removes tokens FCM reports as unregistered or invalid, and keeps the rest', async () => {
    devices.tokensFor.mockResolvedValueOnce(['dead', 'bad', 'busy', 'ok']);
    mockSendEachForMulticast.mockResolvedValueOnce({
      successCount: 1,
      failureCount: 3,
      responses: [
        { success: false, error: { code: 'messaging/registration-token-not-registered' } },
        { success: false, error: { code: 'messaging/invalid-registration-token' } },
        { success: false, error: { code: 'messaging/server-unavailable' } },
        { success: true },
      ],
    });
    await make().send('user-1', 'REQUEST_RECEIVED');
    expect(devices.removeTokens).toHaveBeenCalledWith(['dead', 'bad']);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('messaging/server-unavailable');
    expect(warn.mock.calls[0][0]).not.toContain('busy');
  });

  it('notify never throws and logs only an error code', async () => {
    mockSendEachForMulticast.mockRejectedValueOnce(
      Object.assign(new Error('token tok-a for someone@example.com'), { code: 'app/network-error' }),
    );
    const push = make();
    expect(() => push.notify('user-1', 'REQUEST_RECEIVED')).not.toThrow();
    await new Promise((r) => setImmediate(r));
    expect(warn).toHaveBeenCalledWith('Push REQUEST_RECEIVED failed: app/network-error');
  });

  it('notify returns before the send finishes', () => {
    mockSendEachForMulticast.mockReturnValueOnce(new Promise(() => undefined));
    const result = make().notify('user-1', 'REQUEST_RECEIVED');
    expect(result).toBeUndefined();
  });

  it('disables itself, without echoing the key, when Firebase fails to start', async () => {
    mockInitializeApp.mockImplementationOnce(() => {
      throw Object.assign(new Error(`Invalid PEM ${PEM_BEGIN}abc`), { code: 'app/invalid-credential' });
    });
    const push = make();
    await expect(push.send('user-1', 'REQUEST_RECEIVED')).resolves.toBe(0);
    await expect(push.send('user-1', 'REQUEST_RECEIVED')).resolves.toBe(0);
    expect(mockInitializeApp).toHaveBeenCalledTimes(1);
    expect(error.mock.calls[0][0]).toContain('app/invalid-credential');
    expect(error.mock.calls[0][0]).not.toContain('PRIVATE KEY');
  });
});
