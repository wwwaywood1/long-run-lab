/** Run against npm run dev (or preview) with Playwright installed separately.
 * PLAYWRIGHT_MODULE_PATH, BROWSER_EXECUTABLE_PATH, QA_FONTS_ROOT are optional.
 * Example: node tools/check_crash.mjs http://127.0.0.1:4321
 */
import assert from 'node:assert/strict';
import { assertEnglish, count, translator } from './qa-language.mjs';
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
      if (window.__crashRandomQueue?.length) return window.__crashRandomQueue.shift();
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
  await page.goto(`${base}/${locale}/casino/crash/`);
  await page.locator('[data-crash]').scrollIntoViewIfNeeded();
  await page.waitForFunction(() => !document.querySelector('astro-island[ssr]'));
  await page.evaluate(() => document.fonts.ready); await page.clock.install();
  const tr = translator(locale, 'Crash');
  const advance = async ms => { await page.clock.runFor(ms); await assertEnglish(page, locale); };
  const button = name => page.getByRole('button', { name: tr(name), exact: true });
  const group = name => page.getByRole('group', { name: tr(name), exact: true }).first();
  const table = n => group('同时开几局').getByRole('button', { name: tr(`${n} 局`), exact: true }).click();
  const stake = n => group('每注多少').getByRole('button', { name: locale === 'zh' ? String(n) : `$${n.toLocaleString('en-US')}`, exact: true }).click();
  const target = n => group('自动跳车点').getByRole('button', { name: `${n}×`, exact: true }).click();
  const force = points => page.evaluate(points => { window.__crashRandomQueue = points.map(p => p <= 1 ? 0 : 1 - .97 / (p + .002)); }, points);
  const stats = async () => {
    const text = await page.locator('[data-stats]').innerText();
    const m = text.match(locale === 'en' ? /([\d,]+) rounds? · ([\d,]+) bets? · cash-out rate (.+)/ : /已飞 ([\d,]+) 轮 · 共 ([\d,]+) 注 · 跳车成功 (.+)/);
    assert.ok(m, text); return [Number(m[1].replaceAll(',', '')), Number(m[2].replaceAll(',', '')), m[3]];
  };
  const expectStats = async (rounds, bets) => assert.deepEqual((await stats()).slice(0, 2), [rounds, bets]);
  const screenshot = async name => {
    await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await assertEnglish(page, locale);
  await page.screenshot({ path: `${out}/crash-${locale}-${name}.png`, fullPage: true, animations: 'disabled' });
  };
  const other = locale === 'zh' ? 'en' : 'zh';
  assert.equal(await page.locator(`.lang-switch a[lang="${other}"]`).getAttribute('href'), `/${other}/casino/crash/`);
  assert.equal(await page.locator('.site-footer a').getAttribute('href'), `/${locale}/research/ville/`);
  assert.equal(await page.locator('.cr-zero-cell').count(), 100);
  assert.equal(await page.locator('.cr-zero-cell.zero').count(), 3);
  assert.deepEqual(await page.locator('.cr-prob-bar span').allTextContents(), ['64.7%', '48.5%', '32.3%', '19.4%', '9.70%', '4.85%', '1.94%', '0.97%']);
  assert.equal(await page.locator('[data-crash] .cr-minute').evaluate(el => getComputedStyle(el).color), locale === 'zh' ? 'rgb(21, 128, 61)' : 'rgb(211, 58, 53)');
  for (const width of [390, 640]) {
    await page.setViewportSize({ width, height: 844 }); await page.evaluate(() => window.scrollTo(0, 0));
    assert.deepEqual(await page.locator('[data-crash] button, .lang-switch a').evaluateAll(elements => elements.filter(el => { const r = el.getBoundingClientRect(); return r.width < 44 || r.height < 44; }).map(el => el.textContent)), []);
    assert.deepEqual(await page.locator('.cr-controls .cr-row:first-child .seg button').evaluateAll(elements => elements.filter(el => el.scrollWidth > el.clientWidth).map(el => el.textContent)), []);
    await screenshot(String(width));
  }
  await page.setViewportSize({ width: 390, height: 844 });
  const rate = await page.locator('[data-crash] .cr-minute').innerText();
  for (const [value, probability] of [[1.5, '64.7%'], [2, '48.5%'], [5, '19.4%'], [10, '9.7%']]) {
    await target(value);
    assert.ok((await page.locator('.cr-target .shared-note').innerText()).includes(probability));
    assert.equal(await page.locator('[data-crash] .cr-minute').innerText(), rate);
  }
  await target(2);
  if (locale === 'en') assert.equal(await page.locator('.cr-target .shared-note').innerText(), 'Chance of cashing out in a round: 48.5%. Win $10 if you do, lose $10 if it crashes.');
  assert.equal(await page.locator('.cr-any mark').innerText(), locale === 'en' ? 'exactly the same' : '一分不差');
  await force([1]); await button('起飞').click(); await advance(100);
  await expectStats(1, 1); assert.equal(await page.locator('[data-flight-status]').innerText(), tr('爆了'));
  if (locale === 'en') assert.equal(await page.locator('.cr-result').innerText(), 'Busted at 1.00× · you lose $10');
  assert.equal(await page.locator('.cr-head strong').innerText(), '1.00×'); await screenshot('390-bust');
  // Equality counts as a successful automatic jump.
  await button('重来').click(); await force([2]); await button('起飞').click(); await advance(2400);
  await expectStats(1, 1); assert.equal((await stats())[2], '100.0%');
  assert.equal(await page.locator('[data-flight-status]').innerText(), locale === 'en' ? 'Cashed out at 2.00×' : '已在 2.00× 跳车');
  if (locale === 'en') assert.equal(await page.locator('.cr-result').innerText(), 'You win $10 · it later crashed at 2.00×');
  assert.equal(await page.locator('[data-cash-marker]').getAttribute('fill-opacity'), '1'); await screenshot('390-auto');
  // Manual jump affects only active games, at the last displayed cent multiplier.
  await button('重来').click(); await target(10); await force([4]); await button('起飞').click(); await advance(500);
  assert.equal(await group('每注多少').getByRole('button').first().isDisabled(), true);
  await screenshot('390-flying'); await button('现在跳车').click();
  assert.equal(await button('现在跳车').isDisabled(), true);
  const manualStatus = await page.locator('[data-flight-status]').innerText();
  const manualMatch = manualStatus.match(locale === 'en' ? /Cashed out at ([0-9]+\.[0-9]{2})×/ : /已在 ([0-9]+\.[0-9]{2})× 跳车/);
  assert.ok(manualMatch, manualStatus);
  const manualCash = Number(manualMatch[1]);
  assert.ok(manualCash >= 1 && manualCash < 10);
  await advance(4000); await expectStats(1, 1);
  assert.ok(Math.abs(Number((await page.locator('.pnl-header .value').innerText()).replace(/[^0-9.]/g, '')) - (manualCash - 1) * 10) < .051); await screenshot('390-manual');
  // A single successful jump continues showing the outcome, bounded by the display cap.
  await button('重来').click(); await target(2); await force([100]); await button('起飞').click(); await advance(2400);
  await expectStats(0, 0); assert.equal(await button('现在跳车').isDisabled(), true);
  await button('重来').click(); await advance(12000); await expectStats(0, 0);
  assert.equal(await page.locator('[data-flight-status]').innerText(), tr('等待起飞'));
  // Accumulate 100 skipped rounds across three table counts and stakes.
  await button('快进 100 轮').click(); await expectStats(100, 100);
  await table(10); await stake(100); await button('快进 100 轮').click(); await expectStats(200, 1100);
  assert.equal(await page.locator('.cr-tile').count(), 10); await screenshot('390-ten');
  await table(100); await stake(1000); await button('快进 100 轮').click(); await expectStats(300, 11100);
  assert.equal(await page.locator('[data-crash] .hundred-grid > .cr-cell').count(), 100); await screenshot('390-hundred');
  // Mixed manual cash-out cannot resurrect three already-exploded games.
  await button('重来').click(); await table(10); await stake(100); await target(2);
  await force([1, 2, 4, 1, 2, 4, 1, 2, 4, 4]); await button('起飞').click(); await advance(500);
  assert.equal(await page.locator('.cr-tile.bust').count(), 3);
  await button('现在跳车').click(); await advance(100); await expectStats(1, 10);
  assert.equal(await page.locator('.cr-tile.bust').count(), 3); assert.equal(await page.locator('.cr-tile.cashed').count(), 7);
  assert.match(await page.locator('.cr-result').innerText(), locale === 'en' ? /7 cashed out · 3 busted/ : /跳车成功 7 局 · 爆了 3 局/);
  await screenshot('390-mixed');
  await button('重来').click(); await table(100); await force(Array.from({ length: 100 }, (_, i) => i % 2 ? 4 : 1));
  await button('起飞').click(); await advance(100);
  assert.equal(await page.locator('.cr-cell.bust').count(), 50); assert.equal(await page.locator('.cr-cell.flying').count(), 50);
  if (locale === 'en') assert.equal(await page.locator('.cr-result').innerText(), '50 still flying · 0 cashed out · 50 busted');
  await screenshot('390-hundred-flying'); await button('重来').click();
  // Stop during flight: complete this round, no next round.
  await force(Array(100).fill(4)); await button('自动玩').click(); await advance(100); await button('停下').click();
  await advance(5000); await expectStats(1, 100);
  // Stop in the gap after an immediate explosion: cancel queued callback.
  await force(Array(100).fill(1)); await button('自动玩').click(); await advance(100); await button('停下').click();
  await advance(5000); await expectStats(2, 200);
  await force(Array(100).fill(4)); await button('自动玩').click(); await advance(100);
  await button('重来').click(); await advance(5000); await expectStats(0, 0);
  // Latest automatic settings: ten at 2x, then one hundred at 5x.
  await table(10); await target(2); await force([...Array(10).fill(2), ...Array(100).fill(5)]);
  await button('自动玩').click(); await advance(2400); await expectStats(1, 10);
  await table(100); await stake(1000); await target(5); await advance(6100);
  await button('停下').click(); await advance(5000); await expectStats(2, 110);
  assert.equal(await page.locator('.cr-cell.cashed').count(), 100);
  await button('重来').click();
  await page.locator(`.lang-switch a[lang="${other}"]`).click(); assert.equal(new URL(page.url()).pathname, `/${other}/casino/crash/`);
  await page.goto(`${base}/${locale}/casino/slots/`); await page.locator('.next-link').click();
  assert.equal(new URL(page.url()).pathname, `/${locale}/casino/crash/`);
  assert.deepEqual(errors, []);
  reports.push({ locale, widths: [390, 640], checks: 'sourced probability/zero grid, all targets/table counts/stakes, automatic equality, manual net and marker, mixed cash-outs, single display cap/reset, fast-forward totals, auto stop during flight/gap, latest target/stake/table state, reset cancellation, language/Slots navigation, footer target, loss colors, touch sizes, overflow, console', passed: true });
  await page.close();
}
await writeFile('qa-output/g4-browser-results.json', JSON.stringify({ reports }, null, 2) + '\n');
console.log(JSON.stringify(reports, null, 2));
} finally { await browser.close(); }
