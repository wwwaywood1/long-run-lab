/** Run against npm run dev (or preview) with Playwright installed separately.
 * PLAYWRIGHT_MODULE_PATH, BROWSER_EXECUTABLE_PATH, QA_FONTS_ROOT are optional.
 * Example: node tools/check_baccarat.mjs http://127.0.0.1:4321
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
      if (window.__scratchRandomQueue?.length) return window.__scratchRandomQueue.shift();
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
  await page.goto(`${base}/${locale}/casino/scratch/`);
  await page.locator('[data-scratch]').scrollIntoViewIfNeeded();
  await page.waitForFunction(() => !document.querySelector('astro-island[ssr]'));
  await page.evaluate(() => document.fonts.ready); await page.clock.install();
  const tr = translator(locale, 'Scratch');
  const button = zh => page.getByRole('button', { name: tr(zh), exact: true });
  const buyButton = n => page.getByRole('button', { name: locale === 'en' ? `Buy ${count(n, 'ticket')}` : `买${n === 1 ? '一' : n}张`, exact: true });
  const table = n => page.getByRole('group', { name: tr('一次买几张'), exact: true }).first().getByRole('button', { name: tr(`${n} 张`), exact: true }).click();
  const cell = n => page.locator(`[data-cell="${n}"]`);
  const assertCny = async () => {
    assert.doesNotMatch(await page.locator('[data-scratch]').innerText(), /\$/);
    if (locale === 'en') assert.match(await page.locator('.pnl-header .value').innerText(), /yuan$/);
  };
  const advance = async ms => { await page.clock.runFor(ms); await assertEnglish(page, locale); await assertCny(); };
  const counters = async () => {
    await assertEnglish(page, locale); await assertCny();
    const text = await page.locator('[data-stats]').innerText();
    const m = text.match(locale === 'en' ? /^Scratched ([\d,]+) · “wins” ([\d,]+) · break-even only ([\d,]+)$/ : /^已刮 ([\d,]+) 张 · “中奖” ([\d,]+) 张 · 其中只拿回本钱 ([\d,]+) 张$/);
    assert.ok(m, text); const [cards, hits, evens] = m.slice(1).map(s => Number(s.replaceAll(',', '')));
    assert.ok(evens <= hits && hits <= cards); return { cards, hits, evens };
  };
  const expectCards = async n => assert.equal((await counters()).cards, n);
  const net = async () => Number((await page.locator('.pnl-header .value').innerText()).replace('−', '-').replace(/[^\d.\-]/g, ''));
  const reset = async () => { await button('重来').click(); await expectCards(0); };
  const screenshot = async name => {
    await assertEnglish(page, locale); await assertCny(); await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: `${out}/scratch-${locale}-${name}.png`, fullPage: true, animations: 'disabled' });
  };
  // Exact RNG fixtures: the regular engine still generates the ticket and its matching cell.
  const force = async amounts => {
    const prizes = [10, 20, 50, 100, 500, 1000, 10000, 100000, 1000000];
    const frequencies = [170000, 92500, 25000, 8000, 600, 200, 10, 1, .2];
    const queue = [];
    for (const amount of amounts) {
      const index = prizes.indexOf(amount), lower = frequencies.slice(0, index).reduce((a, b) => a + b, 0);
      queue.push(amount === 0 ? .99 : (lower + frequencies[index] / 2) / 1e6);
      queue.push(...Array(8).fill(0)); // winning 1, 2; your numbers 3 ... 8
      queue.push(.6, .7, .8, .9, .4, .5); // large printed decoys are independent of the actual prize
      if (amount > 0) queue.push(4.01 / 6, .01); // cell 6 contains the matching number 1
    }
    await page.evaluate(queue => { window.__scratchRandomQueue = queue; }, queue);
  };
  const other = locale === 'zh' ? 'en' : 'zh';
  assert.equal(await page.locator(`.lang-switch a[lang="${other}"]`).getAttribute('href'), `/${other}/casino/scratch/`);
  assert.equal(await page.locator('.site-footer a').getAttribute('href'), `/${locale}/ending/`);
  assert.equal(await page.locator('.sc-outcome-cell').count(), 100);
  assert.equal(await page.locator('.sc-outcome-cell.win').count(), 13);
  assert.equal(await page.locator('.sc-outcome-cell.even').count(), 17);
  assert.equal(await page.locator('.sc-outcome-cell.miss').count(), 70);
  assert.equal(await page.locator('.sc-reveal .big').innerText(), '57%');
  assert.equal(await page.locator('.sc-edge-claim mark').innerText(), '35%');
  assert.deepEqual(await page.locator('.sc-flow-row > span').allTextContents(), locale === 'en' ? ['6.50 yuan', '2 yuan', '1.50 yuan'] : ['6.50 元', '2 元', '1.50 元']);
  await expectCards(0);
  assert.equal(await button('一键刮开').isDisabled(), true);
  for (const width of [390, 640]) {
    await page.setViewportSize({ width, height: 844 }); await page.evaluate(() => window.scrollTo(0, 0));
    assert.deepEqual(await page.locator('[data-scratch] button, .lang-switch a').evaluateAll(elements => elements.filter(el => { const r = el.getBoundingClientRect(); return r.width < 44 || r.height < 44; }).map(el => el.textContent)), []);
    await screenshot(String(width));
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await force([20]); await buyButton(1).click();
  assert.equal(await page.locator('.sc-ticket button.covered').count(), 8);
  assert.equal(await page.locator('.sc-mine button > span').allTextContents().then(text => text.join('')), '');
  assert.equal(await buyButton(1).isDisabled(), true); assert.equal(await button('快进 100 次').isDisabled(), true);
  assert.equal(await page.getByRole('group', { name: tr('一次买几张'), exact: true }).getByRole('button').first().isDisabled(), true);
  assert.equal(await page.locator('.sc-banner strong').innerText(), locale === 'en' ? 'Still 8 to go' : '还有 8 格');
  await cell(6).focus(); await cell(6).press('Enter');
  assert.equal(await cell(6).getAttribute('aria-pressed'), 'true'); assert.equal(await cell(6).locator('strong').innerText(), '1');
  assert.equal(await cell(6).locator('span').innerText(), locale === 'en' ? '¥20' : '20元');
  assert.equal(await page.locator('.sc-mine button.hit').count(), 0); await expectCards(0);
  await cell(6).evaluate(el => { el.click(); el.click(); }); await expectCards(0);
  assert.equal(await page.locator('.sc-banner strong').innerText(), locale === 'en' ? 'Still 7 to go' : '还有 7 格');
  await screenshot('390-partial');
  for (const index of [4, 0, 7, 2, 1, 3]) await cell(index).click();
  await expectCards(0); await cell(5).focus(); await cell(5).press('Space');
  await expectCards(1); assert.equal(await net(), 10);
  assert.equal(await page.locator('.sc-mine button.hit').count(), 1);
  assert.equal(await page.locator('.sc-mine button.hit strong').innerText(), '1');
  assert.equal(await page.locator('.sc-banner strong').innerText(), locale === 'en' ? 'You win 20 yuan' : '中奖 20 元');
  await screenshot('390-win');
  await cell(5).evaluate(el => el.click()); await expectCards(1);
  await reset(); await force([0]); await buyButton(1).click(); await button('一键刮开').click();
  assert.equal(await net(), -10); assert.equal(await page.locator('.sc-mine button.hit').count(), 0);
  assert.equal(await page.locator('.sc-banner span').evaluate(el => getComputedStyle(el).color), locale === 'zh' ? 'rgb(21, 128, 61)' : 'rgb(211, 58, 53)');
  await screenshot('390-miss');
  await reset(); await force([10]); await buyButton(1).click(); await button('一键刮开').click();
  assert.deepEqual(await counters(), { cards: 1, hits: 1, evens: 1 }); assert.equal(await net(), 0);
  assert.equal(await page.locator('.sc-banner strong').innerText(), locale === 'en' ? 'Win ¥10!' : '中奖 10 元！');
  assert.equal(await page.locator('.sc-banner').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(255, 224, 102)');
  await screenshot('390-even');
  for (const amount of [50, 100, 500, 1000, 10000, 100000, 1000000]) {
    await reset(); await force([amount]); await buyButton(1).click(); await button('一键刮开').click();
    await expectCards(1); assert.equal(await net(), amount - 10);
    const label = await page.locator('.sc-mine button.hit span').innerText();
    if (locale === 'en' && amount === 1000) assert.equal(label, '¥1,000');
    if (locale === 'en' && amount === 10000) assert.equal(label, '¥10K');
    if (locale === 'en' && amount === 100000) assert.equal(label, '¥100K');
    if (locale === 'en' && amount === 1000000) assert.equal(label, '¥1M');
    if (amount === 1000000) await screenshot('390-jackpot');
  }
  await reset(); await table(10); await force([0, 10, 20, 0, 10, 0, 50, 0, 0, 100]);
  await buyButton(10).click(); await advance(100); assert.equal(await page.locator('.sc-tile.pending').count(), 10); await expectCards(0);
  await advance(650); assert.deepEqual(await counters(), { cards: 10, hits: 5, evens: 2 }); assert.equal(await net(), 90);
  assert.equal(await page.locator('.sc-tile.win').count(), 3); assert.equal(await page.locator('.sc-tile.even').count(), 2); assert.equal(await page.locator('.sc-tile.miss').count(), 5);
  if (locale === 'en') assert.equal(await page.locator('.sc-result').innerText(), 'This buy: 10 tickets, 5 “wins”, 2 break-even only · +90 yuan');
  await screenshot('390-ten');
  await reset(); await table(100); await force(Array.from({ length: 100 }, (_, i) => [0, 10, 20][i % 3]));
  await buyButton(100).click(); await advance(750); await expectCards(100); assert.equal(await net(), -10);
  assert.equal(await page.locator('.sc-cell.win').count(), 33); assert.equal(await page.locator('.sc-cell.even').count(), 33); assert.equal(await page.locator('.sc-cell.miss').count(), 34);
  await screenshot('390-hundred');
  await reset(); await table(1); await button('快进 100 次').click(); await expectCards(100);
  await table(10); await button('快进 100 次').click(); await expectCards(1100);
  await table(100); await button('快进 100 次').click(); await expectCards(11100); await screenshot('390-fast');
  assert.ok(await page.locator('.loss-conversion-inline').count());
  // Finish only the current automated ticket when stopped during its delay.
  await reset(); await table(1); await force([10]); await button('一直买').click(); await advance(100); await button('停下').click(); await advance(5000);
  assert.deepEqual(await counters(), { cards: 1, hits: 1, evens: 1 });
  await force([0]); await button('一直买').click(); await advance(550); await button('停下').click(); await advance(5000); await expectCards(2);
  // Autoplay can finish a partially scratched manual ticket, with no double counting.
  await reset(); await force([20]); await buyButton(1).click(); await cell(0).click(); await button('一直买').click(); await advance(20); await button('停下').click(); await advance(5000);
  await expectCards(1); assert.equal(await net(), 10);
  // Manual reveal must cancel the previous scheduled auto-reveal before buying again.
  await reset(); await force([20, 0]); await button('一直买').click(); await advance(100); await button('一键刮开').click(); await expectCards(1);
  await buyButton(1).click(); await button('停下').click(); await advance(5000); await expectCards(2); assert.equal(await net(), 0);
  // Reset clears both reveal and next-buy timers, including before 500ms.
  await reset(); await button('一直买').click(); await advance(100); await reset(); await advance(5000); await expectCards(0);
  await table(10); await button('一直买').click(); await advance(100); await button('停下').click(); await advance(5000); await expectCards(10);
  await button('一直买').click(); await advance(750); await button('停下').click(); await advance(5000); await expectCards(20);
  await button('一直买').click(); await advance(100); await reset(); await advance(5000); await expectCards(0);
  // Changing count during the pause affects the next batch, and fast-forward resets the pause.
  await table(10); await button('一直买').click(); await advance(750); await expectCards(10);
  await table(100); await advance(1500); await button('停下').click(); await advance(5000); await expectCards(110);
  await reset(); await button('一直买').click(); await advance(750); await expectCards(100);
  await button('快进 100 次').click(); await expectCards(10100); await button('停下').click(); await advance(5000); await expectCards(10100);
  await reset();
  await page.locator(`.lang-switch a[lang="${other}"]`).click(); assert.equal(new URL(page.url()).pathname, `/${other}/casino/scratch/`);
  await page.goto(`${base}/${locale}/casino/lottery/`); await page.locator('.next-link').click(); assert.equal(new URL(page.url()).pathname, `/${locale}/casino/scratch/`);
  await page.goto(`${base}/${locale}/casino/`); await page.locator('a[href$="/casino/scratch/"]').first().click(); assert.equal(new URL(page.url()).pathname, `/${locale}/casino/scratch/`);
  assert.deepEqual(errors, []);
  reports.push({ locale, widths: [390, 640], checks: 'eight-cell manual and keyboard reveal, hidden values, arbitrary reveal order, one settlement only, all prize amounts including ¥10K/¥100K/¥1M, no win/break-even/profit, matching printed prize, 1/10/100 tickets, fast-forward totals, auto stop in reveal and gap, manual-auto takeover, reset cancellation, fresh count, CNY amounts and prices, full English templates, sourced flow and 100-grid, 44px touch sizes, no overflow/console errors/Chinese on English UI, language/Lottery/lobby links', passed: true });
  await page.close();
}
await writeFile('qa-output/g7-browser-results.json', JSON.stringify({ reports }, null, 2) + '\n');
console.log(JSON.stringify(reports, null, 2));
} finally { await browser.close(); }
