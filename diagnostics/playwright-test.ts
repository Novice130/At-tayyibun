import { chromium } from 'playwright';

const BASE = 'https://attayyibun.com';

async function runTests() {
  console.log('Starting Playwright tests...\n');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const results = [];

  // Test 1: Health/API status
  try {
    console.log('Test 1: API health check...');
    const resp = await page.goto(`${BASE}/api/admin/analytics`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    const status = resp?.status();
    const body = await page.evaluate(() => document.body.innerText).catch(() => '');
    results.push({ test: 'API health', status, body: body.slice(0, 100), ok: status === 200 });
    console.log(`  Status: ${status}, Body: ${body.slice(0, 100)}`);
  } catch (e) {
    results.push({ test: 'API health', error: e.message, ok: false });
    console.log(`  ERROR: ${e.message}`);
  }

  // Test 2: Login page loads
  try {
    console.log('\nTest 2: Login page...');
    const resp = await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 15000 });
    const status = resp?.status();
    const title = await page.title();
    results.push({ test: 'Login page', status, title, ok: status === 200 });
    console.log(`  Status: ${status}, Title: ${title}`);
  } catch (e) {
    results.push({ test: 'Login page', error: e.message, ok: false });
    console.log(`  ERROR: ${e.message}`);
  }

  // Test 3: Admin page (expect redirect to login or challenge)
  try {
    console.log('\nTest 3: Admin page (expect redirect or challenge)...');
    const resp = await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle', timeout: 15000 });
    const status = resp?.status();
    const url = page.url();
    results.push({ test: 'Admin page', status, url, ok: status === 200 });
    console.log(`  Status: ${status}, URL: ${url}`);
  } catch (e) {
    results.push({ test: 'Admin page', error: e.message, ok: false });
    console.log(`  ERROR: ${e.message}`);
  }

  // Test 4: Check console errors
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 15000 });
  results.push({ test: 'Console errors', errors: errors.slice(0, 5), ok: errors.length === 0 });
  console.log(`\nConsole errors: ${errors.length}`);
  errors.slice(0, 3).forEach(e => console.log(`  - ${e.slice(0, 100)}`));

  await browser.close();

  console.log('\n=== RESULTS ===');
  results.forEach(r => console.log(`${r.ok ? '✅' : '❌'} ${r.test}: ${r.error || r.status || 'OK'}`));

  const passed = results.filter(r => r.ok).length;
  console.log(`\n${passed}/${results.length} tests passed`);
}

runTests().catch(console.error);