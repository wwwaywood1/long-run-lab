/** Run against npm run dev (or preview) with Playwright installed separately.
 * PLAYWRIGHT_MODULE_PATH, BROWSER_EXECUTABLE_PATH, QA_FONTS_ROOT are optional.
 * Example: node tools/check_slots.mjs http://127.0.0.1:4321
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
      if (window.__slotRandomQueue?.length) return window.__slotRandomQueue.shift();
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
  await page.goto(`${base}/${locale}/casino/slots/`);
  await page.locator('[data-slots]').scrollIntoViewIfNeeded();
  await page.waitForFunction(() => !document.querySelector('astro-island[ssr]'));
  await page.evaluate(() => document.fonts.ready);
  await page.clock.install();
  const button = name => page.getByRole('button', { name, exact: true });
  const group = name => page.getByRole('group', { name, exact: true }).first();
  const table = n => group('同时开几台').getByRole('button', { name: `${n} 台`, exact: true }).click();
  const stake = n => group('每次投多少').getByRole('button', { name: locale === 'zh' ? String(n) : `$${n}`, exact: true }).click();
  const counters = async () => {
    const text = await page.locator('[data-stats]').innerText();
    const m = text.match(/已拉 ([\d,]+) 次 · 响铃 ([\d,]+) 次 · 其中 ([\d,]+) 次其实在亏/);
    assert.ok(m, text);
    const values = m.slice(1).map(n => Number(n.replaceAll(',', '')));
    assert.ok(values[2] <= values[1] && values[1] <= values[0]);
    return values;
  };
  const expectSpins = async n => assert.equal((await counters())[0], n);
  const force = async stops => page.evaluate(stops => { window.__slotRandomQueue = stops.map(stop => stop / 20 + .001); }, stops);
  const screenshot = async name => {
    await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: `${out}/slots-${locale}-${name}.png`, fullPage: true, animations: 'disabled' });
  };
  assert.equal(await page.locator('html').getAttribute('lang'), locale);
  const other = locale === 'zh' ? 'en' : 'zh';
  assert.equal(await page.locator(`.lang-switch a[lang="${other}"]`).getAttribute('href'), `/${other}/casino/slots/`);
  assert.equal(await page.locator('.sl-reveal-cell').count(), 100);
  assert.equal(await page.locator('.sl-reveal-cell.win').count(), 17);
  assert.equal(await page.locator('.sl-reveal-cell.ldw').count(), 42);
  assert.equal(await page.locator('.sl-reveal-cell.miss').count(), 41);
  assert.deepEqual(await page.locator('.sl-pay-row .sl-prob').allTextContents(), ['0.05%', '0.23%', '0.34%', '0.34%', '1.56%', '14.06%', '42.19%']);
  assert.deepEqual(await page.locator('.sl-summary .sl-mono').allTextContents(), ['91.8%', '8.0%']);
  assert.equal(await page.locator('.sl-summary .sl-minute').innerText(), '8.2%');
  assert.equal(await page.locator('[data-slots] .sl-minute').evaluate(el => getComputedStyle(el).color), locale === 'zh' ? 'rgb(21, 128, 61)' : 'rgb(211, 58, 53)');
  for (const width of [390, 640]) {
    await page.setViewportSize({ width, height: 844 });
    await page.evaluate(() => window.scrollTo(0, 0));
    assert.deepEqual(await page.locator('[data-slots] button, .lang-switch a').evaluateAll(elements => elements.filter(el => {
      const r = el.getBoundingClientRect(); return r.width < 44 || r.height < 44;
    }).map(el => el.textContent)), []);
    await screenshot(String(width));
  }
  await page.setViewportSize({ width: 390, height: 844 });
  // Force a half-stake return: visual celebration must still report a net loss.
  await stake(1); await force([1, 0, 1]); await button('拉一下').click();
  await page.clock.runFor(100); await expectSpins(0);
  assert.equal(await group('同时开几台').getByRole('button').first().isDisabled(), true);
  await page.clock.runFor(1800);
  assert.deepEqual(await counters(), [1, 1, 1]);
  assert.equal(await page.locator('.sl-banner').getAttribute('class'), 'sl-banner ldw');
  assert.equal(await page.locator('.sl-banner').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(255, 224, 102)');
  assert.match(await page.locator('.pnl-header .value').innerText(), /−/);
  assert.match(await page.locator('.sl-banner span').innerText(), /其实亏了/);
  const centers = await page.locator('.sl-strip').evaluateAll(strips => strips.map(el => {
    const y = new DOMMatrix(getComputedStyle(el).transform).m42;
    return Math.round(-y / 64 + 1) % 20;
  }));
  assert.deepEqual(centers, [1, 0, 1]);
  await screenshot('390-ldw');
  await button('重来').click(); await force([0, 0, 12]); await button('拉一下').click(); await page.clock.runFor(1900);
  assert.equal(await page.locator('.sl-banner strong').innerText(), '差一点！');
  assert.deepEqual(await counters(), [1, 0, 0]); await screenshot('390-near');
  await button('重来').click(); await force([0, 0, 13]); await button('拉一下').click(); await page.clock.runFor(1900);
  assert.equal(await page.locator('.sl-banner').getAttribute('class'), 'sl-banner win');
  assert.deepEqual(await counters(), [1, 1, 0]);
  assert.match(await page.locator('.sl-banner strong').innerText(), /200/);
  assert.match(await page.locator('.sl-banner span').innerText(), /199/); await screenshot('390-jackpot');
  await button('重来').click(); await force([0, 0, 1]); await button('拉一下').click(); await page.clock.runFor(1900);
  assert.equal(await page.locator('.sl-banner').getAttribute('class'), 'sl-banner miss');
  assert.deepEqual(await counters(), [1, 0, 0]);
  await button('快进 100 次').click(); await expectSpins(101);
  await table(10); await stake(10); await button('快进 100 次').click(); await expectSpins(1101);
  assert.equal(await page.locator('.sl-tile').count(), 10); await screenshot('390-ten');
  await table(100); await stake(100); await button('快进 100 次').click(); await expectSpins(11101);
  assert.equal(await page.locator('[data-slots] .hundred-grid > .sl-cell').count(), 100);
  for (const cell of await page.locator('.sl-cell.ldw').all()) assert.equal(await cell.innerText(), '−♪');
  await screenshot('390-hundred');
  await button('重来').click(); await expectSpins(0);
  // Stop while moving and in the gap between pulls.
  await button('自动拉').click(); await page.clock.runFor(100);
  await button('停下').click(); await page.clock.runFor(5000); await expectSpins(100);
  await button('自动拉').click(); await page.clock.runFor(1150);
  await button('停下').click(); await page.clock.runFor(5000); await expectSpins(200);
  await button('自动拉').click(); await page.clock.runFor(100);
  await button('重来').click(); await page.clock.runFor(5000); assert.deepEqual(await counters(), [0, 0, 0]);
  // The queued callback reads the newly selected machine count.
  await table(10); await button('自动拉').click(); await page.clock.runFor(1150);
  await table(100); await page.clock.runFor(1800);
  await button('停下').click(); await page.clock.runFor(5000); await expectSpins(110);
  await button('重来').click(); await table(1);
  // Reset before the 40ms start callback must prevent delayed strip movement.
  await button('自动拉').click(); await page.clock.runFor(20); await button('重来').click(); await page.clock.runFor(5000);
  assert.deepEqual(await counters(), [0, 0, 0]);
  assert.equal(await page.locator('.sl-banner strong').innerText(), '拉一下试试');
  await page.locator(`.lang-switch a[lang="${other}"]`).click();
  assert.equal(new URL(page.url()).pathname, `/${other}/casino/slots/`);
  // The previously deferred Baccarat next-table link now reaches this page.
  await page.goto(`${base}/${locale}/casino/baccarat/`);
  await page.locator('.next-link').click(); assert.equal(new URL(page.url()).pathname, `/${locale}/casino/slots/`);
  assert.deepEqual(errors, []);
  reports.push({ locale, widths: [390, 640], checks: 'sourced reveal/paytable, all machine counts and stakes, strip center alignment, LDW net loss, adjacent near miss, jackpot gross/net, cumulative rings/fakes, fast-forward, auto stop during pull/gap, latest settings, reset before animation and settlement, language/Baccarat navigation, loss colors, touch sizes, overflow, console', passed: true });
  await page.close();
}
await writeFile('qa-output/g3-browser-results.json', JSON.stringify({ reports }, null, 2) + '\n');
console.log(JSON.stringify(reports, null, 2));
} finally { await browser.close(); }
