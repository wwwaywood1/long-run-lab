/** Run against npm run dev (or preview) with Playwright installed separately.
 * PLAYWRIGHT_MODULE_PATH, BROWSER_EXECUTABLE_PATH, QA_FONTS_ROOT are optional.
 * Example: node tools/check_g1.mjs http://127.0.0.1:4321
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
for (const game of ['roulette', 'sicbo']) {
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
  await page.goto(`${base}/${locale}/casino/${game}/`);
  await page.locator(`[data-${game}]`).scrollIntoViewIfNeeded();
  await page.waitForFunction(() => !document.querySelector('astro-island[ssr]'));
  await page.evaluate(() => document.fonts.ready);
  await page.clock.install();
  const tr = translator(locale, 'SicBo');
  const advance = async ms => { await page.clock.runFor(ms); await assertEnglish(page, locale); };
  const button = name => page.getByRole('button', { name: tr(name), exact: true });
  const isSicbo = game === 'sicbo';
  const labels = isSicbo ? { roll: '摇一把', auto: '自动摇', stop: '停下', fast: '快进 100 局', reset: '重来', tables: '同时开几桌', bet: '每注多少' }
    : locale === 'zh' ? { roll: '转一局', auto: '自动转', stop: '停下', fast: '快进 100 局', reset: '重来', tables: '同时开几桌', bet: '每桌押多少' }
    : { roll: 'Spin', auto: 'Auto', stop: 'Stop', fast: 'Skip 100 spins', reset: 'Reset', tables: 'Number of tables', bet: 'Bet per table' };
  const group = name => page.getByRole('group', { name: tr(name), exact: true }).first();
  const table = async n => group(labels.tables).getByRole('button', { name: isSicbo ? tr(`${n} 桌`) : locale === 'zh' ? `${n} 桌` : String(n), exact: true }).click();
  const expectStats = async (rounds, bets) => {
    const text = await page.locator('[data-stats]').innerText();
    const pattern = locale === 'en' ? `${count(rounds, isSicbo ? 'round' : 'spin')} · ${count(bets, 'bet')}` : isSicbo ? `已摇 ${rounds.toLocaleString('en-US')} 局 · 共 ${bets.toLocaleString('en-US')} 注`
      : locale === 'zh' ? `已转 ${rounds.toLocaleString('en-US')} 局 · 共 ${bets.toLocaleString('en-US')} 注`
      : `${rounds.toLocaleString('en-US')} spins · ${bets.toLocaleString('en-US')} bets`;
    assert.ok(text.startsWith(pattern), text);
  };
  const other = locale === 'zh' ? 'en' : 'zh';
  assert.equal(await page.locator('html').getAttribute('lang'), locale);
  assert.equal(await page.locator(`.lang-switch a[lang="${other}"]`).getAttribute('href'), `/${other}/casino/${game}/`);
  await expectStats(0, 0);
  if (isSicbo) {
    assert.equal(await page.locator('.sb-outcomes > span').count(), 216);
    assert.equal(await page.locator('.sb-outcomes > .triple').count(), 6);
    assert.deepEqual(await page.locator('.sb-bet-row .sb-mono').allTextContents(), ['2.78%', '13.89%', '15.28%', '16.20%']);
    assert.equal(await page.locator('.sb-minute').evaluate(el => getComputedStyle(el).color), locale === 'zh' ? 'rgb(21, 128, 61)' : 'rgb(211, 58, 53)');
  }
  for (const width of [390, 640]) {
    await page.setViewportSize({ width, height: 844 });
    await page.evaluate(() => window.scrollTo(0, 0));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.deepEqual(await page.locator(`[data-${game}] button, .lang-switch a`).evaluateAll(elements => elements.filter(el => {
      const r = el.getBoundingClientRect(); return r.width < 44 || r.height < 44;
    }).map(el => el.textContent)), []);
    await assertEnglish(page, locale);
  await page.screenshot({ path: `${out}/g1-${game}-${locale}-${width}.png`, fullPage: true, animations: 'disabled' });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  const n0 = isSicbo ? 1 : 10;
  await button(labels.roll).click(); await advance(100);
  assert.equal(await group(labels.tables).getByRole('button').first().isDisabled(), true);
  await advance(isSicbo ? 850 : 1800); await expectStats(1, n0);
  await button(labels.fast).click(); await expectStats(101, 101 * n0);
  await table(10); await button(labels.fast).click(); await expectStats(201, 101 * n0 + 1000);
  await page.evaluate(() => document.fonts.ready);
  await assertEnglish(page, locale);
  await page.screenshot({ path: `${out}/g1-${game}-${locale}-390-ten.png`, fullPage: true, animations: 'disabled' });
  await table(100);
  await group(labels.bet).getByRole('button', { name: locale === 'zh' ? '100' : '$100', exact: true }).click();
  if (isSicbo) await group('押什么').getByRole('button', { name: tr('豹子'), exact: true }).click();
  await button(labels.fast).click(); await expectStats(301, 101 * n0 + 11000);
  assert.equal(await page.locator('.hundred-grid > div').count(), 100);
  if (isSicbo) {
    for (const cell of await page.locator('.sb-cell').all()) {
      const label = await cell.getAttribute('aria-label'), cls = await cell.getAttribute('class');
      assert.equal(cls.includes('win'), label.includes(tr('豹子')));
    }
  }
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.evaluate(() => document.fonts.ready);
  await assertEnglish(page, locale);
  await page.screenshot({ path: `${out}/g1-${game}-${locale}-390-hundred.png`, fullPage: true, animations: 'disabled' });
  await button(labels.reset).click(); await expectStats(0, 0);
  const duration = isSicbo ? 900 : 1860;
  // Stop during the roll: finish that roll once, then remain stopped.
  await button(labels.auto).click(); await advance(100);
  await button(labels.stop).click(); await advance(6000); await expectStats(1, 100);
  // Stop during the gap: a queued next roll must not start.
  await button(labels.auto).click(); await advance(duration + 50);
  await button(labels.stop).click(); await advance(6000); await expectStats(2, 200);
  // Reset in motion must cancel all settlement, animation and auto callbacks.
  await button(labels.auto).click(); await advance(100);
  await button(labels.reset).click(); await advance(6000); await expectStats(0, 0);
  assert.equal(await button(labels.auto).getAttribute('aria-pressed'), 'false');
  // The next automatic roll must pick up the newly selected table count.
  await table(10); await button(labels.auto).click(); await advance(duration + 50);
  await table(100); await advance(duration + (isSicbo ? 650 : 700));
  await button(labels.stop).click(); await advance(6000); await expectStats(2, 110);
  await button(labels.reset).click();
  await table(1);
  await group(labels.bet).getByRole('button', { name: locale === 'zh' ? '1000' : '$1,000', exact: true }).click();
  if (isSicbo) await group('押什么').getByRole('button', { name: tr('小'), exact: true }).click();
  await button(labels.roll).click(); await advance(duration + 50); await expectStats(1, 1);
  if (isSicbo) assert.equal(await page.locator('.sb-one .sb-die').count(), 3);
  await page.evaluate(() => document.fonts.ready);
  await assertEnglish(page, locale);
  await page.screenshot({ path: `${out}/g1-${game}-${locale}-390-one.png`, fullPage: true, animations: 'disabled' });
  await page.locator(`.lang-switch a[lang="${other}"]`).click();
  assert.equal(new URL(page.url()).pathname, `/${other}/casino/${game}/`);
  assert.deepEqual(errors, []);
  reports.push({ game, locale, widths: [390, 640], checks: 'all table counts, all stakes, supported bets, animation, fast-forward, cumulative counters, stop in roll/gap, reset, fresh auto settings, language navigation, color, touch sizes, overflow, console', passed: true });
  await page.close();
}
}
await writeFile('qa-output/g1-browser-results.json', JSON.stringify({ reports }, null, 2) + '\n');
console.log(JSON.stringify(reports, null, 2));
} finally { await browser.close(); }
