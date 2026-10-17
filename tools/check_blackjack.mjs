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
      if (window.__bjRandomQueue?.length) return window.__bjRandomQueue.shift();
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
  await page.goto(`${base}/${locale}/casino/blackjack/`);
  await page.locator('[data-blackjack]').scrollIntoViewIfNeeded();
  await page.waitForFunction(() => !document.querySelector('astro-island[ssr]'));
  await page.evaluate(() => document.fonts.ready); await page.clock.install();
  const tr = translator(locale, 'Blackjack');
  const button = zh => page.getByRole('button', { name: tr(zh), exact: true });
  const group = zh => page.getByRole('group', { name: tr(zh), exact: true }).first();
  const advance = async ms => { await page.clock.runFor(ms); await assertEnglish(page, locale); };
  const action = key => page.locator(`[data-action="${key}"]`);
  const table = n => group('同时开几桌').getByRole('button', { name: tr(`${n} 桌`), exact: true }).click();
  const stake = n => group('每注多少').getByRole('button', { name: locale === 'en' ? `$${n.toLocaleString('en-US')}` : String(n), exact: true }).click();
  const payout = label => group('黑杰克赔率').getByRole('button', { name: label, exact: true }).click();
  const strategy = zh => group('自动策略').getByRole('button', { name: tr(zh), exact: true }).click();
  const expectStats = async (rounds, hands) => {
    await assertEnglish(page, locale);
    assert.equal(await page.locator('[data-stats]').innerText(), locale === 'en' ? `${count(rounds, 'round')} · ${count(hands, 'hand')}` : `已玩 ${rounds.toLocaleString('en-US')} 局 · 共 ${hands.toLocaleString('en-US')} 手`);
  };
  const net = async () => Number((await page.locator('.pnl-header .value').innerText()).replace('−', '-').replace(/[^0-9.\-]/g, ''));
  const screenshot = async name => {
    await assertEnglish(page, locale); await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: `${out}/blackjack-${locale}-${name}.png`, fullPage: true, animations: 'disabled' });
  };
  // Construct a Fisher-Yates input stream for a desired opening shoe. No production hooks.
  const forceCards = async ranks => {
    const deck = Array.from({ length: 6 }, (_, d) => ['♠', '♥', '♣', '♦'].flatMap((s, suit) => ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'].map((r, rank) => ({ id: d * 52 + suit * 13 + rank, r })))).flat();
    const remaining = [...deck];
    const desired = ranks.map(rank => { const i = remaining.findIndex(c => c.r === rank); assert.ok(i >= 0); return remaining.splice(i, 1)[0]; });
    const target = [...remaining, ...desired.reverse()], current = [...deck], queue = [];
    for (let i = current.length - 1; i > 0; i--) {
      const j = current.findIndex(card => card.id === target[i].id);
      assert.ok(j <= i); queue.push((j + .01) / (i + 1)); [current[i], current[j]] = [current[j], current[i]];
    }
    await page.evaluate(queue => { window.__bjRandomQueue = queue; }, queue);
  };
  const reset = async () => { await button('重来').click(); await expectStats(0, 0); };
  const other = locale === 'zh' ? 'en' : 'zh';
  assert.equal(await page.locator(`.lang-switch a[lang="${other}"]`).getAttribute('href'), `/${other}/casino/blackjack/`);
  assert.equal(await page.locator('.bj-bust-cell').count(), 100);
  assert.equal(await page.locator('.bj-bust-cell.player-bust').count(), 16);
  assert.equal(await page.locator('.bj-bust-cell.both-bust').count(), 4);
  assert.deepEqual(await page.locator('.bj-strategy-bar .bj-mono').allTextContents(), ['0.5%', '1.8%', '5.6%', '6.0%']);
  assert.equal(await page.locator('.bj-counting mark').innerText(), locale === 'en' ? 'you lose the slowest' : '输得最慢');
  assert.equal(await page.locator('.bj-minute').evaluate(el => getComputedStyle(el).color), locale === 'zh' ? 'rgb(21, 128, 61)' : 'rgb(211, 58, 53)');
  await expectStats(0, 0);
  for (const width of [390, 640]) {
    await page.setViewportSize({ width, height: 844 }); await page.evaluate(() => window.scrollTo(0, 0));
    assert.deepEqual(await page.locator('[data-blackjack] button, .lang-switch a').evaluateAll(elements => elements.filter(el => { const r = el.getBoundingClientRect(); return r.width < 44 || r.height < 44; }).map(el => el.textContent)), []);
    await screenshot(String(width));
  }
  await page.setViewportSize({ width: 390, height: 844 });
  for (const key of ['H', 'S', 'D', 'P']) assert.equal(await action(key).isDisabled(), true);
  await button('算牌：关').click(); assert.equal(await page.locator('.bj-count').innerText(), tr('Hi-Lo 计数：发牌后开始'));
  await forceCards(['5', '6', '6', '10', '10', '10']); await button('发牌').click();
  await expectStats(0, 0); assert.equal(await page.locator('.bj-card.back').count(), 1);
  assert.equal(await action('D').isEnabled(), true); assert.equal(await action('P').isDisabled(), true);
  assert.match(await page.locator('.bj-hint').innerText(), locale === 'en' ? /^Basic strategy suggests: Double$/ : /^基本策略建议：加倍$/);
  assert.match(await page.locator('.bj-count').innerText(), locale === 'en' ? /^Hi-Lo count \+3 · true count \+0.5 · decks left: 5.9$/ : /^Hi-Lo 计数 \+3 · 真数 \+0.5 · 牌靴剩 5.9 副$/);
  assert.equal(await button('发牌').isDisabled(), true); assert.equal(await button('快进 100 局').isDisabled(), true);
  for (const zh of ['同时开几桌', '每注多少', '黑杰克赔率', '自动策略']) assert.equal(await group(zh).getByRole('button').first().isDisabled(), true);
  await screenshot('390-hint-count');
  await button('提示：开').click(); assert.equal(await page.locator('.bj-hint').innerText(), ''); await button('提示：关').click();
  await action('D').click(); await advance(2500); await expectStats(1, 1); assert.equal(await net(), 20);
  assert.equal(await page.locator('.bj-card.back').count(), 0);
  assert.ok((await page.locator('.bj-hand small').allTextContents()).includes(tr('已加倍')));
  await screenshot('390-double');
  await reset(); await forceCards(['2', '6', '3', '10', '2', '10']); await button('发牌').click();
  await action('H').click(); assert.equal(await action('D').isDisabled(), true);
  await action('S').click(); await advance(2500); await expectStats(1, 1); assert.equal(await net(), 10);
  await reset(); await forceCards(['8', '6', '8', '10', '3', '2', '10', '10']); await button('发牌').click();
  assert.equal(await action('P').isEnabled(), true); await action('P').click();
  assert.equal(await page.locator('.bj-hand').count(), 3); assert.equal(await action('P').isDisabled(), true);
  await action('D').click(); await action('S').click(); await advance(2500); await expectStats(1, 1); assert.equal(await net(), 30);
  assert.ok((await page.locator('.bj-hand strong').allTextContents()).some(text => text.includes(locale === 'en' ? 'You · Hand 2' : '你 · 第 2 手')));
  await screenshot('390-split');
  await reset(); await forceCards(['A', '9', 'A', '8', 'K', 'Q']); await button('发牌').click(); await action('P').click();
  await advance(2000); await expectStats(1, 1); assert.equal(await net(), 20);
  assert.equal((await page.locator('.bj-total').allTextContents()).some(text => /blackjack|黑杰克/.test(text)), false);
  for (const [pay, expected] of [['3:2', 15], ['6:5', 12]]) {
    await reset(); await payout(pay); await forceCards(['A', '9', 'K', '8']); await button('发牌').click();
    await advance(2000); await expectStats(1, 1); assert.equal(await net(), expected);
    if (locale === 'en') assert.match(await page.locator('.bj-hand-tag').last().innerText(), /^Blackjack \$1[25]$/);
  }
  await reset(); await forceCards(['9', 'A', '8', 'K']); await button('发牌').click(); await advance(2000);
  await expectStats(1, 1); assert.equal(await net(), -10);
  await reset(); await forceCards(['10', 'A', '7', '6']); await button('发牌').click(); await action('S').click(); await advance(2000);
  await expectStats(1, 1); assert.equal(await net(), 0);
  await reset(); await forceCards(['10', '6', '6', '10', '10']); await button('发牌').click(); await action('H').click(); await advance(2000);
  await expectStats(1, 1); assert.equal(await net(), -10); await screenshot('390-bust');
  // Stop while the player is thinking hands control back to the user, without a second hand.
  await reset(); await forceCards(['10', '10', '2', '8', '2']); await button('自动玩').click();
  await button('停下').click(); await advance(3000); await expectStats(0, 0);
  assert.equal(await action('S').isEnabled(), true); await action('S').click(); await advance(4000); await expectStats(1, 1);
  // Start auto in the middle of a manual hand, then stop during the dealer phase.
  await reset(); await forceCards(['10', '6', '8', '10', '10']); await button('发牌').click(); await button('自动玩').click();
  await advance(30); await button('停下').click(); await advance(4000); await expectStats(1, 1);
  // Cancel a queued next hand after settlement.
  await reset(); await forceCards(['10', '10', '8', '7']); await button('自动玩').click(); await advance(1950);
  await expectStats(1, 1); await button('停下').click(); await advance(4000); await expectStats(1, 1);
  await reset(); await forceCards(['10', '10', '2', '8']); await button('自动玩').click(); await advance(100); await reset(); await advance(4000); await expectStats(0, 0);
  // Fast-forward and all strategies, payouts, stakes and table counts.
  await payout('3:2'); await button('快进 100 局').click(); await expectStats(100, 100);
  await table(10); await stake(100); await strategy('学庄家'); await button('发牌').click(); await advance(850); await expectStats(101, 110);
  assert.equal(await page.locator('.bj-tile').count(), 10); await screenshot('390-ten');
  await button('快进 100 局').click(); await expectStats(201, 1110);
  await table(100); await stake(1000); await strategy('永不爆牌'); await payout('6:5'); await button('快进 100 局').click(); await expectStats(301, 11110);
  assert.equal(await page.locator('.bj-cell').count(), 100); await screenshot('390-hundred');
  await reset(); await button('自动玩').click(); await advance(100); await button('停下').click(); await advance(4000); await expectStats(1, 100);
  await button('自动玩').click(); await advance(850); await button('停下').click(); await advance(4000); await expectStats(2, 200);
  await button('自动玩').click(); await advance(100); await reset(); await advance(4000); await expectStats(0, 0);
  // The pending auto callback reads the new settings and maintains cumulative totals.
  await table(10); await button('自动玩').click(); await advance(850); await expectStats(1, 10);
  await table(100); await stake(10); await strategy('基本策略'); await payout('3:2'); await advance(1750);
  await button('停下').click(); await advance(4000); await expectStats(2, 110);
  // Fast-forward while auto is waiting still schedules exactly one next hand.
  await reset(); await button('自动玩').click(); await advance(850); await expectStats(1, 100);
  await button('快进 100 局').click(); await expectStats(101, 10100); await button('停下').click(); await advance(4000); await expectStats(101, 10100);
  await reset(); await table(1); await button('算牌：开').click();
  assert.equal(await page.locator('.bj-count').innerText(), '');
  await page.locator(`.lang-switch a[lang="${other}"]`).click(); assert.equal(new URL(page.url()).pathname, `/${other}/casino/blackjack/`);
  await page.goto(`${base}/${locale}/casino/crash/`); await page.locator('.next-link').click(); assert.equal(new URL(page.url()).pathname, `/${locale}/casino/blackjack/`);
  await page.goto(`${base}/${locale}/casino/`); await page.locator('a[href$="/casino/blackjack/"]').first().click(); assert.equal(new URL(page.url()).pathname, `/${locale}/casino/blackjack/`);
  assert.deepEqual(errors, []);
  reports.push({ locale, widths: [390, 640], checks: 'all manual actions, double/split/aces/naturals/push/bust, dealer soft 17, hidden hole and Hi-Lo count, hint/count toggles, strategy/payout/stake/table options, auto stop in player/dealer/gap, auto takeover, fast-forward totals, latest settings, reset cancellation, exact English templates, no Chinese in English states, language/Crash/lobby navigation, sourced reveal, touch sizes, overflow, console', passed: true });
  await page.close();
}
await writeFile('qa-output/g5-browser-results.json', JSON.stringify({ reports }, null, 2) + '\n');
console.log(JSON.stringify(reports, null, 2));
} finally { await browser.close(); }
