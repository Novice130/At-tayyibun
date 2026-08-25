import { chromium } from 'playwright';
import * as fs from 'fs';

const BASE = 'https://attayyibun.com';
const OUT_DIR = '/tmp/playwright_auth';

async function main() {
  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });

  // 1. Mobile Viewport (iPhone 14 / 15 pro dimension: 390x844)
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  });
  const mobilePage = await mobileContext.newPage();

  console.log('1. Capturing Mobile Home Page...');
  await mobilePage.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await mobilePage.waitForTimeout(2000);
  await mobilePage.screenshot({ path: `${OUT_DIR}/mobile_home.png`, fullPage: false });

  console.log('2. Capturing Mobile Login Page...');
  await mobilePage.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await mobilePage.waitForTimeout(2000);
  await mobilePage.screenshot({ path: `${OUT_DIR}/mobile_login.png`, fullPage: false });

  console.log('3. Capturing Mobile Signup Page...');
  await mobilePage.goto(`${BASE}/signup`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await mobilePage.waitForTimeout(2000);
  await mobilePage.screenshot({ path: `${OUT_DIR}/mobile_signup.png`, fullPage: false });

  console.log('4. Capturing Mobile Forgot Password Page...');
  await mobilePage.goto(`${BASE}/forgot-password`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await mobilePage.waitForTimeout(2000);
  await mobilePage.screenshot({ path: `${OUT_DIR}/mobile_forgot_password.png`, fullPage: false });

  // 2. Desktop Viewport (1280x800)
  const desktopContext = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const desktopPage = await desktopContext.newPage();

  console.log('5. Capturing Desktop Home Hero...');
  await desktopPage.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await desktopPage.waitForTimeout(2000);
  await desktopPage.screenshot({ path: `${OUT_DIR}/desktop_home.png`, fullPage: false });

  console.log('6. Capturing Desktop Login Page...');
  await desktopPage.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await desktopPage.waitForTimeout(2000);
  await desktopPage.screenshot({ path: `${OUT_DIR}/desktop_login.png`, fullPage: false });

  await browser.close();
  console.log('All screenshots successfully saved to /tmp/playwright_auth/');
}

main().catch(console.error);
