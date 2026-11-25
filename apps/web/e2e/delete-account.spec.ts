import { test, expect } from '@playwright/test';

test.describe('Delete Account page', () => {
  test('signed-out visitors see sign-in link, email request path, and retention details', async ({
    page,
  }) => {
    await page.route('**/auth/get-session', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: 'null' }),
    );

    await page.goto('/delete-account');

    await expect(page.getByRole('heading', { name: /Delete Account/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Sign in to delete immediately/i })).toHaveAttribute(
      'href',
      '/login?next=/delete-account',
    );
    await expect(page.getByRole('link', { name: /admin@attayyibun\.com/i }).first()).toHaveAttribute(
      'href',
      /^mailto:admin@attayyibun\.com/,
    );
    await expect(page.getByText(/How to delete in the mobile app/i)).toBeVisible();
    await expect(page.getByText(/What is deleted and what is kept/i)).toBeVisible();
  });

  test('signed-in users must type DELETE and then call DELETE /api/users/me', async ({ page }) => {
    let deleteCalled = false;

    await page.route('**/auth/get-session', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: { id: 'u1', email: 'member@example.com', role: 'USER' },
          session: { id: 's1' },
        }),
      }),
    );
    await page.route('**/api/users/me', (route) => {
      if (route.request().method() === 'DELETE') {
        deleteCalled = true;
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true }),
        });
      }
      return route.continue();
    });
    await page.route('**/auth/sign-out', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }),
    );

    await page.goto('/delete-account');

    const submit = page.getByRole('button', { name: /Permanently delete my account/i });
    await expect(submit).toBeDisabled();

    await page.getByLabel('Type DELETE to confirm').fill('DELETE');
    await expect(submit).toBeEnabled();
    await submit.click();

    await expect(page.getByRole('heading', { name: /Account deleted/i })).toBeVisible();
    expect(deleteCalled).toBe(true);
  });
});
