/** Run against npm run dev (or preview) with Playwright installed separately.
 * PLAYWRIGHT_MODULE_PATH, BROWSER_EXECUTABLE_PATH, QA_FONTS_ROOT are optional.
 * Example: node tools/check_baccarat.mjs http://127.0.0.1:4321
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const base = (process.argv[2] || 'http://127.0.0.1:4321').replace(/\/$/, '');
const out = 'qa-output/screenshots';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true,
  executablePath: process.env.BROWSER_EXECUTABLE_PATH || undefined,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
});
const reports = [];
try {
for (const locale of ['zh', 'en']) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  // Fixed random stream makes screenshot content and regression failures reproducible.
  await page.addInitScript(() => {
    let seed = 20261016;
    Math.random = () => {
      let t = seed += 0x6d2b79f5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  });
  // Optional local copies of the same Google font families for offline QA.
  if (process.env.QA_FONTS_ROOT) {
    const root = process.env.QA_FONTS_ROOT;
    let css = '';
    for (const [family, weights] of [['noto-sans-sc', [400, 500, 700]], ['noto-serif-sc', [700, 900]], ['ibm-plex-mono', [500, 600]]]) {
      for (const weight of weights) css += (await readFile(path.join(root, family, `${weight}.css`), 'utf8'))
        .replaceAll('./files/', `https://qa-fonts.local/${family}/files/`);
    }
    await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ contentType: 'text/css', body: css }));
    await page.route('https://qa-fonts.local/**', async route => {
      const relative = new URL(route.request().url()).pathname.slice(1);
      await route.fulfill({ contentType: 'font/woff2', body: await readFile(path.join(root, relative)), headers: { 'Access-Control-Allow-Origin': '*' } });
    });
  }
  await page.goto(`${base}/${locale}/casino/baccarat/`);
  await page.locator('[data-baccarat]').scrollIntoViewIfNeeded();
  await page.waitForFunction(() => !document.querySelector('astro-island[ssr]'));
  await page.evaluate(() => document.fonts.ready);
  await page.clock.install();
  const button = name => page.getByRole('button', { name, exact: true });
  const stats = () => page.locator('[data-stats]').innerText();
  const expectStats = async (rounds, bets) => assert.equal(await stats(), `已发 ${rounds.toLocaleString('en-US')} 局 · 共 ${bets.toLocaleString('en-US')} 注`);
  await expectStats(0, 0);
  assert.match(await page.locator('.bc-vig .bc-explanation').innerText(), /1\.24/);
  assert.deepEqual(await page.locator('.bc-prob .bc-mono').allTextContents(), ['45.86%', '44.62%', '9.52%']);
  assert.deepEqual(await page.locator('.bc-edge .bc-mono').allTextContents(), ['1.06%', '1.24%', '14.36%']);
  assert.equal(await page.locator('html').getAttribute('lang'), locale);
  const other = locale === 'zh' ? 'en' : 'zh';
  assert.equal(await page.locator(`.lang-switch a[lang="${other}"]`).getAttribute('href'), `/${other}/casino/baccarat/`);
  assert.equal(await page.locator('.bc-rate-value').evaluate(el => getComputedStyle(el).color), locale === 'zh' ? 'rgb(21, 128, 61)' : 'rgb(211, 58, 53)');
  for (const width of [390, 640]) {
    await page.setViewportSize({ width, height: 844 });
    await page.evaluate(() => window.scrollTo(0, 0));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    const small = await page.locator('[data-baccarat] button, .lang-switch a').evaluateAll(elements => elements.filter(el => {
      const r = el.getBoundingClientRect(); return r.width < 44 || r.height < 44;
    }).map(el => el.textContent));
    assert.deepEqual(small, []);
    await page.screenshot({ path: `${out}/baccarat-${locale}-${width}.png`, fullPage: true, animations: 'disabled' });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await button('发一局').click();
  await page.clock.runFor(130);
  assert.equal(await page.locator('.bc-card').count(), 1);
  assert.equal(await button('10 桌').isDisabled(), true);
  await page.clock.runFor(3000);
  await expectStats(1, 1);
  assert.equal(await page.locator('.bc-card').count() >= 4, true);
  await button('快进 100 局').click(); await expectStats(101, 101);
  await button('10 桌').click();
  assert.equal(await page.locator('.bc-grid-10 .bc-tile').count(), 10);
  assert.equal(await page.locator('.bc-result').innerText(), '点“发一局”开始');
  await button('快进 100 局').click(); await expectStats(201, 1101);
  await page.screenshot({ path: `${out}/baccarat-${locale}-390-ten.png`, fullPage: true, animations: 'disabled' });
  await button('100 桌').click();
  await page.getByRole('group', { name: '每注多少', exact: true }).getByRole('button', { name: locale === 'zh' ? '100' : '$100', exact: true }).click();
  await page.getByRole('group', { name: '押什么', exact: true }).getByRole('button', { name: '和', exact: true }).click();
  await button('快进 100 局').click(); await expectStats(301, 11101);
  assert.equal(await page.locator('.bc-grid-100 .bc-tile').count(), 100);
  assert.equal(await page.locator('.bc-grid-100 .push').count(), 0);
  assert.equal(await page.locator('.bc-road-dot').count(), 72);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.screenshot({ path: `${out}/baccarat-${locale}-390-hundred.png`, fullPage: true, animations: 'disabled' });
  await button('重来').click(); await expectStats(0, 0);
  // Stop during a hand permits exactly that hand to settle, never another hand.
  await button('自动发').click(); await page.clock.runFor(200);
  await button('停下').click(); await page.clock.runFor(5000); await expectStats(1, 100);
  // Stop during the pause must cancel the already-scheduled callback.
  await button('自动发').click(); await page.clock.runFor(950);
  await button('停下').click(); await page.clock.runFor(5000); await expectStats(2, 200);
  // Reset during a hand cancels both settlement and subsequent auto callbacks.
  await button('自动发').click(); await page.clock.runFor(100);
  await button('重来').click(); await page.clock.runFor(5000); await expectStats(0, 0);
  assert.equal(await page.locator('.bc-road-dot.B, .bc-road-dot.P, .bc-road-dot.T').count(), 0);
  await button('1 桌').click(); await button('自动发').click(); await page.clock.runFor(130);
  await button('重来').click(); await page.clock.runFor(5000); await expectStats(0, 0);
  assert.equal(await page.locator('.bc-card').count(), 0);
  // Latest selected table count is used by the queued auto callback.
  await button('10 桌').click(); await button('自动发').click(); await page.clock.runFor(950);
  await button('100 桌').click(); await page.clock.runFor(1800);
  await button('停下').click(); await page.clock.runFor(5000); await expectStats(2, 110);
  await button('重来').click();
  // Exercise the remaining player bet and the largest stake, then capture dealt cards.
  await button('1 桌').click();
  await page.getByRole('group', { name: '每注多少', exact: true }).getByRole('button', { name: locale === 'zh' ? '1000' : '$1000', exact: true }).click();
  await page.getByRole('group', { name: '押什么', exact: true }).getByRole('button', { name: '闲', exact: true }).click();
  await button('发一局').click(); await page.clock.runFor(3000); await expectStats(1, 1);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${out}/baccarat-${locale}-390-cards.png`, fullPage: true, animations: 'disabled' });
  await page.locator(`.lang-switch a[lang="${other}"]`).click();
  assert.equal(new URL(page.url()).pathname, `/${other}/casino/baccarat/`);
  assert.deepEqual(errors, []);
  reports.push({ locale, widths: [390, 640], checks: 'single-card reveal, 1/10/100 tables, all bets, tie-loss classification, fast-forward, cumulative counters, stop in hand/pause, reset, latest auto state, language navigation, loss colors, touch sizes, overflow, console', passed: true });
  await page.close();
}
await writeFile('qa-output/baccarat-browser-results.json', JSON.stringify({ reports }, null, 2) + '\n');
console.log(JSON.stringify(reports, null, 2));
} finally { await browser.close(); }
