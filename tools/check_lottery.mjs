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
      if (window.__lotteryRandomQueue?.length) return window.__lotteryRandomQueue.shift();
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
  await page.goto(`${base}/${locale}/casino/lottery/`);
  await page.locator('[data-lottery]').scrollIntoViewIfNeeded();
  await page.waitForFunction(() => !document.querySelector('astro-island[ssr]'));
  await page.evaluate(() => document.fonts.ready); await page.clock.install();
  const tr = translator(locale, 'Lottery');
  const button = zh => page.getByRole('button', { name: tr(zh), exact: true });
  const table = n => page.getByRole('group', { name: tr('每期买几注'), exact: true }).getByRole('button', { name: tr(`${n} 注`), exact: true }).click();
  const advance = async ms => { await page.clock.runFor(ms); await assertEnglish(page, locale); await assertCny(); };
  const assertCny = async () => {
    const text = await page.locator('[data-lottery]').innerText(); assert.doesNotMatch(text, /\$/);
    if (locale === 'en') assert.match(await page.locator('.pnl-header .value').innerText(), /yuan$/);
  };
  const counters = async () => {
    await assertEnglish(page, locale); await assertCny();
    const text = await page.locator('[data-stats]').innerText();
    const m = text.match(locale === 'en' ? /^Bought ([\d,]+) draws? \((.+)\) · spent ([\d,]+) yuan · won back ([\d,]+) yuan$/ : /^已买 ([\d,]+) 期（(.+)）· 花了 ([\d,]+) 元 · 拿回 ([\d,]+) 元$/);
    assert.ok(m, text);
    return { draws: Number(m[1].replaceAll(',', '')), elapsed: m[2], spent: Number(m[3].replaceAll(',', '')), won: Number(m[4].replaceAll(',', '')) };
  };
  const expectStats = async (draws, spent) => {
    const stats = await counters(); assert.equal(stats.draws, draws); assert.equal(stats.spent, spent);
    const net = Number((await page.locator('.pnl-header .value').innerText()).replace('−', '-').replace(/[^\d.\-]/g, ''));
    assert.equal(net, stats.won - stats.spent);
  };
  const reset = async () => { await button('重来').click(); await expectStats(0, 0); };
  const screenshot = async name => {
    await assertEnglish(page, locale); await assertCny(); await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: `${out}/lottery-${locale}-${name}.png`, fullPage: true, animations: 'disabled' });
  };
  const winning = { reds: [1, 2, 3, 4, 5, 6], blue: 1 };
  const miss = { reds: [20, 21, 22, 23, 24, 25], blue: 2 };
  const force = async tickets => {
    const queue = [];
    for (const ticket of [...tickets, winning]) {
      const balls = Array.from({ length: 33 }, (_, i) => i + 1);
      for (let j = 0; j < 6; j++) {
        const k = balls.indexOf(ticket.reds[j]); assert.ok(k >= j);
        queue.push((k - j + .01) / (33 - j)); [balls[j], balls[k]] = [balls[k], balls[j]];
      }
      queue.push((ticket.blue - 1 + .01) / 16);
    }
    await page.evaluate(queue => { window.__lotteryRandomQueue = queue; }, queue);
  };
  const other = locale === 'zh' ? 'en' : 'zh';
  assert.equal(await page.locator(`.lang-switch a[lang="${other}"]`).getAttribute('href'), `/${other}/casino/lottery/`);
  assert.equal(await page.locator('.lt-flow mark').innerText(), locale === 'en' ? 'less than 0.5 yuan' : '不到 0.5 元');
  assert.deepEqual(await page.locator('.lt-flow-row > span').allTextContents(), locale === 'en' ? ['0.49 yuan', '0.53 yuan', '0.72 yuan', '0.26 yuan'] : ['0.49 元', '0.53 元', '0.72 元', '0.26 元']);
  assert.equal(await page.locator('.lt-years .big').innerText(), '11,360');
  for (const width of [390, 640]) {
    await page.setViewportSize({ width, height: 844 }); await page.evaluate(() => window.scrollTo(0, 0));
    assert.deepEqual(await page.locator('[data-lottery] button, .lang-switch a').evaluateAll(elements => elements.filter(el => { const r = el.getBoundingClientRect(); return r.width < 44 || r.height < 44; }).map(el => el.textContent)), []);
    await screenshot(String(width));
  }
  await page.setViewportSize({ width: 390, height: 844 }); await expectStats(0, 0);
  await force([miss]); await button('买一期，开奖').click(); await advance(100);
  assert.equal(await page.locator('.lt-draw-balls .lt-ball:not(.empty)').count(), 0);
  assert.equal(await button('坚持买 1 年').isDisabled(), true);
  assert.equal(await button('坚持买 10 年').isDisabled(), true);
  assert.equal(await page.getByRole('group', { name: tr('每期买几注'), exact: true }).getByRole('button').first().isDisabled(), true);
  await advance(120); assert.equal(await page.locator('.lt-draw-balls .lt-ball:not(.empty)').count(), 1);
  await expectStats(0, 0); await screenshot('390-revealing');
  await advance(3000); await expectStats(1, 2);
  assert.equal(await page.locator('.lt-draw-balls .lt-ball:not(.empty)').count(), 7);
  assert.equal(await page.locator('.lt-numbers .lt-ticket-balls .matched').count(), 0);
  assert.equal(await page.locator('.lt-result').innerText(), locale === 'en' ? 'Red balls matched: 0, blue ball missed · No prize' : '红球中 0 个，蓝球没中 · 没中奖');
  assert.equal(await page.locator('.pnl-header .value').evaluate(el => getComputedStyle(el).color), locale === 'zh' ? 'rgb(21, 128, 61)' : 'rgb(211, 58, 53)');
  await screenshot('390-miss');
  const tiers = [
    [winning, 7000000], [{ ...winning, blue: 2 }, 120000],
    [{ reds: [1, 2, 3, 4, 5, 20], blue: 1 }, 3000],
    [{ reds: [1, 2, 3, 4, 5, 20], blue: 2 }, 200],
    [{ reds: [1, 2, 3, 4, 20, 21], blue: 2 }, 10],
    [{ ...miss, blue: 1 }, 5],
  ];
  for (const [index, [ticket, prize]] of tiers.entries()) {
    await reset(); await force([ticket]); await button('买一期，开奖').click(); await advance(3000); await expectStats(1, 2);
    assert.equal((await counters()).won, prize);
    assert.equal(await page.locator('.lt-tier').nth(index).locator('strong').innerText(), '1');
    assert.equal(await page.locator('.lt-numbers .lt-ticket-balls .matched').count(), index === 0 ? 7 : index === 1 ? 6 : index === 2 ? 6 : index === 3 ? 5 : index === 4 ? 4 : 1);
    if (index === 0) await screenshot('390-jackpot');
    if (index === 5) await screenshot('390-sixth');
  }
  await reset(); await table(10); await force([winning, tiers[1][0], ...Array(8).fill(miss)]);
  await button('买一期，开奖').click(); await advance(3000); await expectStats(1, 20);
  assert.equal(await page.locator('.lt-ticket-row').count(), 10);
  assert.equal(await page.locator('.lt-ticket-row strong.won').count(), 2);
  if (locale === 'en') {
    assert.equal(await page.locator('.lt-ticket-row strong').first().innerText(), 'First prize 7,000,000 yuan');
    assert.equal(await page.locator('.lt-ticket-row strong').last().innerText(), 'No prize');
  }
  await screenshot('390-ten');
  await reset(); await table(100); await force([winning, tiers[1][0], ...Array(98).fill(miss)]);
  await button('买一期，开奖').click(); await advance(3000); await expectStats(1, 200);
  assert.equal(await page.locator('.lt-cell').count(), 100);
  assert.equal(await page.locator('.lt-cell').first().innerText(), locale === 'en' ? '7M' : '700万');
  assert.equal(await page.locator('.lt-cell').nth(1).innerText(), locale === 'en' ? '120,000' : '12万');
  assert.deepEqual(await page.locator('.lt-cell').evaluateAll(elements => elements.filter(el => el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight).map(el => ({ text: el.textContent, client: [el.clientWidth, el.clientHeight], scroll: [el.scrollWidth, el.scrollHeight] }))), []);
  await screenshot('390-hundred');
  // Calendar batch totals; English remains yuan and conversions use Chinese item prices.
  await reset(); await table(1); await button('坚持买 1 年').click(); await expectStats(156, 312);
  assert.equal((await counters()).elapsed, locale === 'en' ? 'About 1.0 year' : '约 1.0 年');
  await button('坚持买 10 年').click(); await expectStats(1716, 3432); await screenshot('390-years');
  await table(10); await button('坚持买 1 年').click(); await expectStats(1872, 6552);
  await table(100); await button('坚持买 10 年').click(); await expectStats(3432, 318552);
  assert.match(await page.locator('.loss-conversion-inline').innerText(), locale === 'en' ? /^Spent so far ≈ \d+ / : /^花掉的钱 ≈ \d+ /);
  // Stop while drawing and while waiting for a future draw.
  await reset(); await table(1); await button('每期都买').click(); await advance(100); await button('停下').click(); await advance(6000); await expectStats(1, 2);
  await button('每期都买').click(); await advance(2900); await button('停下').click(); await advance(6000); await expectStats(2, 4);
  await button('每期都买').click(); await advance(100); await reset(); await advance(6000); await expectStats(0, 0);
  assert.equal(await page.locator('.lt-draw-balls .lt-ball:not(.empty)').count(), 0);
  // Switch size in the auto gap; the queued callback must read the latest setting.
  await table(10); await button('每期都买').click(); await advance(2900); await expectStats(1, 20);
  await table(100); await advance(3700); await button('停下').click(); await advance(6000); await expectStats(2, 220);
  await reset(); await button('每期都买').click(); await advance(2900);
  await button('坚持买 1 年').click(); await expectStats(157, 31400); await button('停下').click(); await advance(6000); await expectStats(157, 31400);
  await reset();
  await page.locator(`.lang-switch a[lang="${other}"]`).click(); assert.equal(new URL(page.url()).pathname, `/${other}/casino/lottery/`);
  await page.goto(`${base}/${locale}/casino/blackjack/`); await page.locator('.next-link').click(); assert.equal(new URL(page.url()).pathname, `/${locale}/casino/lottery/`);
  await page.goto(`${base}/${locale}/casino/`); await page.locator('a[href$="/casino/lottery/"]').first().click(); assert.equal(new URL(page.url()).pathname, `/${locale}/casino/lottery/`);
  assert.deepEqual(errors, []);
  reports.push({ locale, widths: [390, 640], checks: 'progressive seven-ball reveal, all six prize tiers/no prize, red and blue matches, 1/10/100 bets, compact jackpot labels, one-year/decade totals, yuan currency and CNY conversion, elapsed singular/plural, prize counters, auto stop during reveal/gap, fresh bet count, fast-forward during auto gap, reset cancellation, localized highlights, source fund flow, 44px touch sizes, no overflow/console errors/Chinese in English states, language/Blackjack/lobby links', passed: true });
  await page.close();
}
await writeFile('qa-output/g6-browser-results.json', JSON.stringify({ reports }, null, 2) + '\n');
console.log(JSON.stringify(reports, null, 2));
} finally { await browser.close(); }
