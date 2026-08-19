// Drive admin login + 2FA via Playwright using fresh OTP read from DB.
// This bypasses email entirely so we can isolate whether the problem is
// browser-side (cookies, JS bundle, Cloudflare) or backend-side.
//
// Run: DATABASE_URL=... npx tsx diagnostics/drive-admin-login.ts
import { chromium } from 'playwright';
import { Pool } from 'pg';

const url = process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL not set'); process.exit(1); }
const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: true } });

async function readLatestOtp(after: Date): Promise<string | null> {
  for (let i = 0; i < 20; i++) {
    const r = await pool.query(
      `SELECT value FROM verification
       WHERE identifier LIKE '2fa-otp%' AND "createdAt" > $1
       ORDER BY "createdAt" DESC LIMIT 1`, [after.toISOString()]);
    if (r.rowCount && r.rowCount > 0) {
      const value = r.rows[0].value as string;
      const code = value.split(':')[0];
      return code;
    }
    await new Promise(r => setTimeout(r, 500));
  }
  return null;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  page.on('console', msg => console.log('[browser]', msg.type(), msg.text()));
  page.on('response', resp => {
    if (resp.url().includes('/auth/')) {
      console.log('[net]', resp.status(), resp.request().method(), resp.url());
    }
  });

  console.log('=== Step 1: open login page ===');
  await page.goto('https://attayyibun.com/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('input[type=email]', { timeout: 15000 });

  console.log('=== Step 2: fill credentials ===');
  const email = process.env.ADMIN_EMAIL || 'admin@attayyibun.com';
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    console.error('ADMIN_PASSWORD env var required');
    process.exit(1);
  }
  await page.fill('input[type=email]', email);
  await page.fill('input[type=password]', password);

  const before = new Date();

  console.log('=== Step 3: click Sign In ===');
  await Promise.all([
    page.waitForURL(/\/admin\/security\/challenge|\/admin($|\/)/, { timeout: 15000 }),
    page.click('button[type=submit]'),
  ]);
  console.log('navigated to', page.url());

  if (!page.url().includes('challenge')) {
    console.log('No 2FA — already on admin dashboard.');
    await browser.close();
    await pool.end();
    return;
  }

  console.log('=== Step 4: wait for OTP in DB ===');
  const code = await readLatestOtp(before);
  if (!code) {
    console.log('FAILED: no OTP in DB after 10s');
    await browser.close();
    await pool.end();
    process.exit(1);
  }
  console.log('OTP read from DB:', code);

  console.log('=== Step 5: type code into 6 inputs ===');
  const inputs = page.locator('form input[type=text]');
  const count = await inputs.count();
  console.log('input count:', count);
  for (let i = 0; i < 6; i++) {
    await inputs.nth(i).fill(code[i]);
  }

  console.log('=== Step 6: click Verify ===');
  await page.click('button[type=submit]');
  await page.waitForTimeout(4000);
  console.log('final url:', page.url());

  const screenshot = await page.screenshot({ fullPage: true });
  require('fs').writeFileSync('diagnostics/admin-login-result.png', screenshot);
  console.log('screenshot saved diagnostics/admin-login-result.png');

  await browser.close();
  await pool.end();
}
main().catch(async e => { console.error(e); await pool.end(); process.exit(1); });
