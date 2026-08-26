import { test, expect } from '@playwright/test';

test.describe('Avatar Selection E2E Flows', () => {
  test('Signup page requires and displays curated avatars based on gender', async ({ page }) => {
    await page.goto('/signup');

    // 1. Step: Creator Role
    await expect(page.getByText(/I am creating this profile as/i)).toBeVisible();
    await page.getByRole('button', { name: /Myself/i }).click();

    // 2. Step: Form Details
    await expect(page.getByRole('heading', { name: /Create Your Account/i })).toBeVisible();
    await page.getByPlaceholder('First name').fill('Fatima');
    await page.getByPlaceholder('your@email.com').fill('fatima@example.com');
    await page.getByPlaceholder('Min 8 characters').fill('Password123!@#');

    // Select Sister (Female)
    await page.getByRole('button', { name: /Sister/i }).click();

    // Proceed to Avatar step
    await page.getByRole('button', { name: /Next: Choose Avatar/i }).click();

    // 3. Step: Choose Avatar
    await expect(page.getByRole('heading', { name: /Choose an Avatar/i })).toBeVisible();
    const avatarImages = page.locator('img[alt="Avatar option"]');
    await expect(avatarImages).toHaveCount(21);

    // Verify images are female avatars
    const firstSrc = await avatarImages.first().getAttribute('src');
    expect(firstSrc).toContain('/avatars/female/');

    // Click first avatar
    await avatarImages.first().click();

    // Accept EULA
    await page.locator('input[type="checkbox"]').check();

    // Create Account button should now be enabled
    const submitBtn = page.getByRole('button', { name: /Create Account/i });
    await expect(submitBtn).toBeEnabled();
  });

  test('Profile Setup (/profile/setup) displays avatar grid and requires avatar selection', async ({ page }) => {
    // Add session cookie so useSession & getSession identify authenticated state
    await page.context().addCookies([
      {
        name: 'better-auth.session_token',
        value: 'sess_123_mock',
        domain: 'localhost',
        path: '/',
      },
    ]);

    const mockSession = {
      user: {
        id: 'usr_google_123',
        email: 'googleuser@example.com',
        name: 'Google User',
        image: 'https://lh3.googleusercontent.com/a/sample',
        role: 'USER',
        phoneNumberVerified: true,
        isPhoneVerified: true,
        phoneGateExempt: true,
      },
      session: {
        id: 'sess_123',
        userId: 'usr_google_123',
      },
    };

    await page.route('**/*session*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockSession),
      });
    });

    await page.route('**/api/profiles/me', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            profile: null,
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        });
      }
    });

    await page.goto('/profile/setup');

    // Wait for the Basic Info card to appear
    await expect(page.getByText('Basic Information')).toBeVisible({ timeout: 15000 });

    // Select Brother
    await page.getByRole('button', { name: 'Brother' }).click();

    // Avatar grid should appear
    await expect(page.getByText(/Choose Your Avatar/i)).toBeVisible();
    const avatarButtons = page.locator('img[alt="Avatar option"]');
    await expect(avatarButtons).toHaveCount(21);

    const firstAvatarSrc = await avatarButtons.first().getAttribute('src');
    expect(firstAvatarSrc).toContain('/avatars/male/');

    // Click an avatar to select it
    await avatarButtons.first().click();

    // Fill remaining step 0 required fields
    await page.getByPlaceholder('Ahmad').fill('Ali');
    await page.getByPlaceholder('Khan').fill('Hassan');
    await page.locator('input[type="date"]').fill('1995-05-15');
    await page.getByPlaceholder(/South Asian/i).fill('Arab');
    await page.getByPlaceholder('Houston').fill('Dallas');
    await page.locator('select').first().selectOption('TX');

    // Click Next (exact match)
    await page.getByRole('button', { name: 'Next', exact: true }).click();

    // Should transition to Step 1: Background & Life
    await expect(page.getByText('Background & Life')).toBeVisible();
  });
});
