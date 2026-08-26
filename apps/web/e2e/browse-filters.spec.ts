import { test, expect } from '@playwright/test';

test.describe('Browse Profiles Filtering & Sorting E2E', () => {
  const mockFemaleProfiles = [
    {
      publicId: 'usr_fem_1',
      firstName: 'Fatima',
      age: 26,
      gender: 'FEMALE',
      ethnicity: 'Arab',
      city: 'Chicago',
      state: 'IL',
      avatarUrl: 'https://attayyibun.com/avatars/female/female-1.jpg',
      bio: 'Practicing Muslimah who loves reading and teaching.',
      membershipTier: 'FREE',
    },
    {
      publicId: 'usr_fem_2',
      firstName: 'Aisha',
      age: 32,
      gender: 'FEMALE',
      ethnicity: 'South Asian',
      city: 'Dallas',
      state: 'TX',
      avatarUrl: 'https://attayyibun.com/avatars/female/female-2.jpg',
      bio: 'Software engineer in Dallas.',
      membershipTier: 'GOLD',
    },
    {
      publicId: 'usr_fem_3',
      firstName: 'Zainab',
      age: 22,
      gender: 'FEMALE',
      ethnicity: 'African',
      city: 'Atlanta',
      state: 'GA',
      avatarUrl: 'https://attayyibun.com/avatars/female/female-3.jpg',
      bio: 'Medical student passionate about community service.',
      membershipTier: 'SILVER',
    },
  ];

  test.beforeEach(async ({ page }) => {
    // Inject authenticated session cookie
    await page.context().addCookies([
      {
        name: 'better-auth.session_token',
        value: 'sess_ahmad_mock',
        domain: 'localhost',
        path: '/',
      },
    ]);

    // Mock male user session (e.g. Ahmad)
    await page.route('**/*session*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 'usr_ahmad_0',
            email: 'ahmad0@example.com',
            name: 'Ahmad Rahman',
            role: 'USER',
            phoneNumberVerified: true,
            isPhoneVerified: true,
          },
          session: {
            id: 'sess_ahmad_mock',
            userId: 'usr_ahmad_0',
          },
        }),
      });
    });

    // Mock user's own profile to return MALE gender
    await page.route('**/api/profiles/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          profile: {
            id: 'prof_ahmad',
            firstName: 'Ahmad',
            gender: 'MALE',
            profileComplete: true,
            ethnicity: 'South Asian',
          },
        }),
      });
    });

    // Mock requests active and incoming endpoints
    await page.route('**/api/requests/active', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(null),
      });
    });

    await page.route('**/api/requests/incoming', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });
  });

  test('Browse page loads opposite gender (FEMALE) profiles by default', async ({ page }) => {
    let capturedUrl = '';
    await page.route('**/api/profiles?*', async (route) => {
      capturedUrl = route.request().url();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: mockFemaleProfiles,
          meta: { total: 3, page: 1, limit: 20, pages: 1 },
        }),
      });
    });

    await page.goto('/browse');
    await expect(page.getByRole('heading', { name: 'Browse Profiles' })).toBeVisible();

    // Verify profile cards render
    await expect(page.getByText('Fatima, 26')).toBeVisible();
    await expect(page.getByText('Aisha, 32')).toBeVisible();
    await expect(page.getByText('Zainab, 22')).toBeVisible();

    // Verify opposite gender filter was requested
    expect(capturedUrl).toContain('gender=FEMALE');
  });

  test('Filtering by Ethnicity passes ethnicity param and displays active chip', async ({ page }) => {
    let lastQuery = '';
    await page.route('**/api/profiles?*', async (route) => {
      lastQuery = route.request().url();
      if (lastQuery.includes('ethnicity=Arab')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: [mockFemaleProfiles[0]],
            meta: { total: 1, page: 1, limit: 20, pages: 1 },
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: mockFemaleProfiles,
            meta: { total: 3, page: 1, limit: 20, pages: 1 },
          }),
        });
      }
    });

    await page.goto('/browse');
    await expect(page.getByText('Fatima, 26')).toBeVisible();

    // Open Filters panel
    await page.getByRole('button', { name: /Filters/i }).click();

    // Select Arab
    await page.locator('#filter-panel select').first().selectOption('Arab');

    // Click Apply Filters
    await page.getByRole('button', { name: /Apply Filters/i }).click();

    // Wait for filtered profile
    await expect(page.getByText('Fatima, 26')).toBeVisible();
    await expect(page.getByText('Aisha, 32')).not.toBeVisible();

    // Verify API called with ethnicity=Arab & gender=FEMALE
    expect(lastQuery).toContain('ethnicity=Arab');
    expect(lastQuery).toContain('gender=FEMALE');

    // Verify active filter chip appeared
    await expect(page.getByRole('button', { name: /Remove ethnicity filter/i })).toBeVisible();

    // Remove ethnicity chip by clicking X
    await page.getByRole('button', { name: /Remove ethnicity filter/i }).click();
    await expect(page.getByText('Aisha, 32')).toBeVisible();
    expect(lastQuery).not.toContain('ethnicity=Arab');
  });

  test('Filtering by Age Range passes minAge and maxAge params and displays chip', async ({ page }) => {
    let lastQuery = '';
    await page.route('**/api/profiles?*', async (route) => {
      lastQuery = route.request().url();
      if (lastQuery.includes('minAge=25') && lastQuery.includes('maxAge=30')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: [mockFemaleProfiles[0]], // Fatima, 26
            meta: { total: 1, page: 1, limit: 20, pages: 1 },
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: mockFemaleProfiles,
            meta: { total: 3, page: 1, limit: 20, pages: 1 },
          }),
        });
      }
    });

    await page.goto('/browse');
    await expect(page.getByText('Fatima, 26')).toBeVisible();

    // Open Filters panel
    await page.getByRole('button', { name: /Filters/i }).click();

    // Enter minAge 25, maxAge 30
    await page.getByPlaceholder('Min (18)').fill('25');
    await page.getByPlaceholder('Max (80)').fill('30');

    // Click Apply Filters
    await page.getByRole('button', { name: /Apply Filters/i }).click();

    // Wait for filtered profile card
    await expect(page.getByText('Fatima, 26')).toBeVisible();
    await expect(page.getByText('Aisha, 32')).not.toBeVisible();

    // Verify API called with minAge=25 and maxAge=30
    expect(lastQuery).toContain('minAge=25');
    expect(lastQuery).toContain('maxAge=30');

    // Verify active filter chip
    await expect(page.getByText('Age: 25 – 30')).toBeVisible();
  });

  test('Changing Sort dropdown updates sortBy and order query params', async ({ page }) => {
    let lastQuery = '';
    await page.route('**/api/profiles?*', async (route) => {
      lastQuery = route.request().url();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: mockFemaleProfiles,
          meta: { total: 3, page: 1, limit: 20, pages: 1 },
        }),
      });
    });

    await page.goto('/browse');
    await expect(page.getByText('Fatima, 26')).toBeVisible();

    // Select "Age: Old to Young"
    await page.getByLabel('Sort profiles').selectOption('age-desc');

    await expect(page.getByText('Fatima, 26')).toBeVisible();
    expect(lastQuery).toContain('sortBy=age');
    expect(lastQuery).toContain('order=desc');
    expect(lastQuery).toContain('gender=FEMALE');

    // Select "Newest First"
    await page.getByLabel('Sort profiles').selectOption('createdAt-desc');
    expect(lastQuery).toContain('sortBy=createdAt');
    expect(lastQuery).toContain('order=desc');
  });

  test('Empty search state allows clearing filters and restores default list', async ({ page }) => {
    let lastQuery = '';

    await page.route('**/api/profiles?*', async (route) => {
      lastQuery = route.request().url();
      if (lastQuery.includes('ethnicity=Turkish')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: [],
            meta: { total: 0, page: 1, limit: 20, pages: 0 },
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: mockFemaleProfiles,
            meta: { total: 3, page: 1, limit: 20, pages: 1 },
          }),
        });
      }
    });

    await page.goto('/browse');
    await expect(page.getByText('Fatima, 26')).toBeVisible();

    // Filter by Turkish (empty results)
    await page.getByRole('button', { name: /Filters/i }).click();
    await page.locator('#filter-panel select').first().selectOption('Turkish');
    await page.getByRole('button', { name: /Apply Filters/i }).click();

    // Verify empty state
    await expect(page.getByText(/No profiles match your filters/i)).toBeVisible();

    // Click Clear Filters
    await page.getByRole('button', { name: /Clear Filters/i }).click();

    // Verify all profiles restored
    await expect(page.getByText('Fatima, 26')).toBeVisible();
    await expect(page.getByText('Aisha, 32')).toBeVisible();
    expect(lastQuery).not.toContain('ethnicity=Turkish');
    expect(lastQuery).toContain('gender=FEMALE');
  });
});
