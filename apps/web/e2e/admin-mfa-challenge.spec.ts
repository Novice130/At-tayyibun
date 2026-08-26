import { test, expect } from '@playwright/test';

test.describe('Admin MFA Challenge Page', () => {
  test.beforeEach(async ({ page }) => {
    // Mock get-session to simulate an admin in the challenge state
    await page.route('**/auth/get-session', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 'admin-123',
            email: 'admin@attayyibun.com',
            name: 'Admin User',
            role: 'SUPER_ADMIN',
            twoFactorEnabled: true,
          },
          session: null,
        }),
      });
    });
  });

  test('Page load does not send an OTP automatically', async ({ page }) => {
    let sendOtpCalls = 0;
    await page.route('**/auth/two-factor/send-otp', async (route) => {
      sendOtpCalls++;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: true }),
      });
    });

    await page.goto('/admin/security/challenge');
    await page.waitForLoadState('networkidle');

    expect(sendOtpCalls).toBe(0);
    await expect(page.getByRole('button', { name: /Send Email Code/i })).toBeVisible();
  });

  test('Send button makes one request and ignores rapid duplicate clicks', async ({ page }) => {
    let sendOtpCalls = 0;
    await page.route('**/auth/two-factor/send-otp', async (route) => {
      sendOtpCalls++;
      await new Promise((r) => setTimeout(r, 100));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: true }),
      });
    });

    await page.goto('/admin/security/challenge');
    const sendButton = page.getByRole('button', { name: /Send Email Code/i });
    await expect(sendButton).toBeVisible();

    await sendButton.click();

    await expect(page.getByText(/Valid for 5 minutes/i)).toBeVisible();
    expect(sendOtpCalls).toBe(1);
    await expect(page.getByText(/Resend code in/i)).toBeVisible();
  });

  test('Email factor calls only /auth/two-factor/verify-otp and does not fall through', async ({ page }) => {
    let verifyOtpCalls = 0;
    let verifyTotpCalls = 0;
    let verifyBackupCalls = 0;

    await page.route('**/auth/two-factor/send-otp', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: true }),
      });
    });

    await page.route('**/auth/two-factor/verify-otp', async (route) => {
      verifyOtpCalls++;
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'INVALID_CODE' }),
      });
    });

    await page.route('**/auth/two-factor/verify-totp', async (route) => {
      verifyTotpCalls++;
      await route.fulfill({ status: 200, body: JSON.stringify({ status: true }) });
    });

    await page.route('**/auth/two-factor/verify-backup-code', async (route) => {
      verifyBackupCalls++;
      await route.fulfill({ status: 200, body: JSON.stringify({ status: true }) });
    });

    await page.goto('/admin/security/challenge');
    await page.getByRole('button', { name: /Send Email Code/i }).click();

    const inputs = page.locator('input[inputmode="numeric"]');
    await expect(inputs.first()).toBeVisible();

    // Paste 6 digits
    await inputs.first().fill('123456');
    await page.getByRole('button', { name: /Verify Account/i }).click();

    // Assert that only verify-otp was called and failed
    await expect(page.getByText(/Invalid email verification code/i).first()).toBeVisible();
    expect(verifyOtpCalls).toBe(1);
    expect(verifyTotpCalls).toBe(0);
    expect(verifyBackupCalls).toBe(0);
  });

  test('Authenticator factor calls only /auth/two-factor/verify-totp', async ({ page }) => {
    let verifyTotpCalls = 0;
    let verifyOtpCalls = 0;

    await page.route('**/auth/two-factor/verify-totp', async (route) => {
      verifyTotpCalls++;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          token: 'sess_123',
          user: { id: 'admin-123', email: 'admin@attayyibun.com' },
        }),
      });
    });

    await page.route('**/auth/two-factor/verify-otp', async (route) => {
      verifyOtpCalls++;
      await route.fulfill({ status: 400, body: JSON.stringify({ message: 'INVALID' }) });
    });

    await page.goto('/admin/security/challenge');
    await page.getByRole('button', { name: /Authenticator/i }).click();

    const inputs = page.locator('input[inputmode="numeric"]');
    await expect(inputs.first()).toBeVisible();

    await inputs.first().fill('654321');
    await page.getByRole('button', { name: /Verify Authenticator/i }).click();

    expect(verifyTotpCalls).toBe(1);
    expect(verifyOtpCalls).toBe(0);
  });

  test('Backup Code factor calls only /auth/two-factor/verify-backup-code', async ({ page }) => {
    let verifyBackupCalls = 0;

    await page.route('**/auth/two-factor/verify-backup-code', async (route) => {
      verifyBackupCalls++;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          token: 'sess_123',
          user: { id: 'admin-123', email: 'admin@attayyibun.com' },
        }),
      });
    });

    await page.goto('/admin/security/challenge');
    await page.getByRole('button', { name: /Backup Code/i }).click();

    const input = page.getByPlaceholder(/Enter backup code/i);
    await expect(input).toBeVisible();

    await input.fill('a1b2c3d4e5');
    await page.getByRole('button', { name: /Verify Backup Code/i }).click();

    expect(verifyBackupCalls).toBe(1);
  });

  test('Shows rate-limit message on 429 error', async ({ page }) => {
    await page.route('**/auth/two-factor/verify-totp', async (route) => {
      await route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'TOO_MANY_ATTEMPTS' }),
      });
    });

    await page.goto('/admin/security/challenge');
    await page.getByRole('button', { name: /Authenticator/i }).click();

    const inputs = page.locator('input[inputmode="numeric"]');
    await inputs.first().fill('111111');
    await page.getByRole('button', { name: /Verify Authenticator/i }).click();

    await expect(page.getByText(/Too many attempts/i).first()).toBeVisible();
  });
});
