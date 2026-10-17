/** G9 browser acceptance. Run against npm run dev or preview.
 * Optional PLAYWRIGHT_MODULE_PATH, BROWSER_EXECUTABLE_PATH, QA_FONTS_ROOT.
 */
import assert from 'node:assert/strict';
import { assertEnglish, translator } from './qa-language.mjs';
import { createRequire } from 'node:module';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const base = (process.argv[2] || 'http://127.0.0.1:4321').replace(/\/$/, '');
const out = 'qa-output/screenshots'; await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE_PATH || undefined,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });
const reports = [];
try {
for (const locale of ['zh', 'en']) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    let seed = 20261017;
    Math.random = () => {
      if (window.__sportsRandomQueue?.length) return window.__sportsRandomQueue.shift();
      let t = seed += 0x6d2b79f5; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  });
  if (process.env.QA_FONTS_ROOT) {
    const root = process.env.QA_FONTS_ROOT; let css = '';
    for (const [family, weights] of [['noto-sans-sc', [400, 500, 700]], ['noto-serif-sc', [700, 900]], ['ibm-plex-mono', [500, 600]]]) for (const weight of weights) css += (await readFile(path.join(root, family, `${weight}.css`), 'utf8')).replaceAll('./files/', `https://qa-fonts.local/${family}/files/`);
    await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ contentType: 'text/css', body: css }));
    await page.route('https://qa-fonts.local/**', async route => route.fulfill({ contentType: 'font/woff2', body: await readFile(path.join(root, new URL(route.request().url()).pathname.slice(1))), headers: { 'Access-Control-Allow-Origin': '*' } }));
  }
  await page.goto(`${base}/${locale}/casino/sports/`); await page.locator('[data-sports]').scrollIntoViewIfNeeded();
  await page.waitForFunction(() => !document.querySelector('astro-island[ssr]') && document.querySelector('.sp-match'));
  await page.evaluate(() => document.fonts.ready); await page.clock.install();
  const tr = translator(locale, 'Sports');
  const button = zh => page.getByRole('button', { name: tr(zh), exact: true });
  const tables = n => page.getByRole('group', { name: tr('同时下几单'), exact: true }).first().getByRole('button', { name: locale === 'en' ? `${n} ${n === 1 ? 'bet' : 'bets'}` : `${n} 单`, exact: true }).click();
  const legs = n => page.getByRole('group', { name: tr('串几场'), exact: true }).getByRole('button', { name: n === 1 ? tr('单关') : locale === 'en' ? `${n} legs, 1 bet` : `${n} 串 1`, exact: true }).click();
  const bet = n => page.getByRole('group', { name: tr('每单多少'), exact: true }).getByRole('button', { name: locale === 'en' ? `$${n.toLocaleString('en-US')}` : `${n.toLocaleString('en-US')} 元`, exact: true }).click();
  const pick = (match, outcome) => page.locator('.sp-match').nth(match).locator(`[data-outcome="${outcome}"]`).click();
  const advance = async ms => { await page.clock.runFor(ms); await assertEnglish(page, locale); };
  const counters = async () => {
    const text = await page.locator('[data-stats]').innerText();
    const m = text.match(locale === 'en' ? /^([\d,]+) bets? · ([\d,]+) won · Hit rate (.+)$/ : /^已下 ([\d,]+) 单 · 全中 ([\d,]+) 单 · 命中率 (.+)$/);
    assert.ok(m, text); return { bets: Number(m[1].replaceAll(',', '')), wins: Number(m[2].replaceAll(',', '')), rate: m[3] };
  };
  const expectCounts = async (bets, wins) => { const s = await counters(); assert.equal(s.bets, bets); if (wins !== undefined) assert.equal(s.wins, wins); };
  const netText = () => page.locator('.pnl-header .value').innerText();
  const force = values => page.evaluate(values => { window.__sportsRandomQueue = values; }, values);
  const matchRng = result => [0, 0, 0, .5, result === 0 ? 0 : result === 1 ? .5 : .9, 0, .9];
  const forceRound = async (n, k, wins) => {
    const queue = [];
    for (let i = 0; i < n; i++) for (let j = 0; j < k; j++) queue.push(...matchRng(i < wins || j > 0 ? 0 : 2));
    await force(queue); await button('重来').click();
  };
  const touch = async () => assert.deepEqual(await page.locator('button, .lang-switch a').evaluateAll(nodes => nodes.filter(n => {
    const r = n.getBoundingClientRect(); return r.width > 0 && r.height > 0 && (r.width < 44 || r.height < 44);
  }).map(n => ({ text: n.textContent, width: n.getBoundingClientRect().width, height: n.getBoundingClientRect().height }))), []);
  const screenshot = async name => {
    await assertEnglish(page, locale); await touch();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: `${out}/sports-${locale}-${name}.png`, fullPage: true, animations: 'disabled' });
  };
  assert.equal(await page.locator('.sp-vig .big').innerText(), '8.8%');
  assert.equal(await page.locator('.sp-growth > strong').innerText(), '+39.5%');
  assert.equal(await page.locator('.sp-return-row').count(), 6); assert.equal(await page.locator('.sp-parlay mark').count(), 1);
  const other = locale === 'en' ? 'zh' : 'en';
  assert.equal(await page.locator(`.lang-switch a[lang="${other}"]`).getAttribute('href'), `/${other}/casino/sports/`);
  assert.equal(await page.locator('.next-link').getAttribute('href'), `/${locale}/casino/`);
  assert.equal(await page.locator('.site-footer a').getAttribute('href'), `/${locale}/ending/`);
  assert.equal(await button('开赛').isDisabled(), true); assert.equal((await page.locator('.sp-score').allInnerTexts()).join(''), '');
  await screenshot('390'); await page.setViewportSize({ width: 640, height: 844 }); await screenshot('640'); await page.setViewportSize({ width: 390, height: 844 });
  // Single match: every choice, keyboard, true probability and a winning settlement.
  await legs(1); await forceRound(1, 1, 1); await expectCounts(0, 0);
  assert.equal(await page.locator('[data-slip-text]').innerText(), locale === 'en' ? 'Picked 0 / 1 match' : '已选 0 / 1 场');
  const home = page.locator('.sp-match [data-outcome="0"]'); await home.focus(); await page.keyboard.press('Space');
  await pick(0, 1); await pick(0, 2); await pick(0, 0);
  assert.equal(await button('开赛').isDisabled(), false);
  await button('看真实概率').click(); assert.equal(await button('真实概率：开').getAttribute('aria-pressed'), 'true');
  assert.deepEqual(await page.locator('.sp-truth').allInnerTexts(), locale === 'en' ? ['True 39%', 'True 22%', 'True 39%'] : ['真实 39%', '真实 22%', '真实 39%']);
  await button('真实概率：开').click(); assert.equal((await page.locator('.sp-truth').allInnerTexts()).join(''), '');
  await button('看真实概率').click();
  await screenshot('390-picks'); await button('开赛').click();
  assert.equal(await button('快进 100 轮').isDisabled(), true); assert.equal(await page.locator('.sp-config button:disabled').count(), 10);
  await advance(249); assert.equal(await page.locator('.sp-score').innerText(), '');
  await advance(1); assert.equal(await page.locator('.sp-score').innerText(), '1 : 0'); await expectCounts(0, 0);
  await advance(380); await expectCounts(1, 1); assert.equal((await counters()).rate, '100.0%');
  assert.equal(await netText(), locale === 'en' ? '+$13.6' : '+13.6 元');
  const oldSlip = await page.locator('[data-slip-text]').innerText(); await bet(1000);
  assert.equal(await page.locator('[data-slip-text]').innerText(), oldSlip); assert.equal(await netText(), locale === 'en' ? '+$13.6' : '+13.6 元');
  await screenshot('390-win'); await button('下一轮').click(); await expectCounts(1, 1); assert.equal(await button('开赛').isDisabled(), true);
  // Two legs: partial disclosure, one wrong loses the whole bet, and no early bookkeeping.
  await bet(10); await legs(2); await force([...matchRng(0), ...matchRng(2)]); await button('重来').click(); await button('押热门').click();
  await button('开赛').click(); await advance(250); assert.deepEqual(await page.locator('.sp-score').allInnerTexts(), ['1 : 0', '']); await expectCounts(0, 0); await screenshot('390-in-play');
  await advance(800); await expectCounts(1, 0); assert.equal(await netText(), locale === 'en' ? '−$10' : '−10 元');
  assert.equal(await page.locator('.sp-match.wrong').count(), 1); assert.equal(await page.locator('.sp-outcomes .actual:not(.selected)').count(), 1);
  await screenshot('390-loss');
  // Reset during live play cancels every pending score and settlement callback.
  await button('下一轮').click(); await button('押热门').click(); await button('开赛').click(); await advance(260); await button('重来').click(); await advance(5000); await expectCounts(0, 0);
  assert.equal((await page.locator('.sp-score').allInnerTexts()).join(''), '');
  // Ten independently generated two-leg bets; verbs use unsigned amounts in English.
  await tables(10); await forceRound(10, 2, 3); await button('开赛').click(); await advance(900); await expectCounts(10, 3);
  assert.equal(await page.locator('.sp-tile.right').count(), 3); assert.equal(await page.locator('.sp-tile.wrong').count(), 7);
  assert.equal(await netText(), locale === 'en' ? '+$67.1' : '+67.1 元');
  for (const text of await page.locator('.sp-tile > strong').allInnerTexts()) if (locale === 'en') assert.doesNotMatch(text, /^(Won|Lost) [−+]/);
  await screenshot('390-ten');
  // Hundred eight-leg bets: shape/text as well as color, and actual rounded-odds expectation.
  await tables(100); await legs(8); await forceRound(100, 8, 2); await button('开赛').click(); await advance(100);
  assert.equal(await page.locator('.sp-cell').first().getAttribute('aria-label'), tr('比赛中…'));
  await advance(800); await expectCounts(100, 2);
  assert.equal(await page.locator('.sp-cell').count(), 100); assert.equal(await page.locator('.sp-cell.right').count(), 2); assert.equal(await page.locator('.sp-cell.wrong').count(), 98);
  assert.equal(await page.locator('.pnl-chart path').count(), 2); await screenshot('390-hundred');
  await page.setViewportSize({ width: 640, height: 844 }); await screenshot('640-hundred'); await page.setViewportSize({ width: 390, height: 844 });
  await force([]); await button('重来').click(); await button('快进 100 轮').click(); await expectCounts(10000);
  await screenshot('390-fast');
  // Stop during a round finishes that round and schedules no more.
  await button('重来').click(); await button('自动押').click(); await advance(100); await button('停下').click(); await advance(2000); await expectCounts(100); await advance(3000); await expectCounts(100);
  // Auto reads the latest bet/table/leg settings in the between-round pause.
  await tables(1); await legs(1); await bet(10); await button('重来').click(); await button('自动押').click(); await advance(700); await expectCounts(1);
  await bet(1000); await tables(10); await legs(4); await advance(1900); await expectCounts(11); await button('停下').click(); await advance(2000); await expectCounts(11);
  // Fast-forward replaces the auto timer; Stop cancels its replacement.
  await bet(100); await button('重来').click(); await button('自动押').click(); await advance(900); await expectCounts(10);
  await button('快进 100 轮').click(); await expectCounts(1010); await button('停下').click(); await advance(3000); await expectCounts(1010);
  await screenshot('390-auto-fast');
  await button('自动押').click(); await advance(100); await button('重来').click(); await advance(5000); await expectCounts(0, 0);
  // The loss uses the locale token. Default empty state and live mount remain deterministic.
  await tables(1); await legs(1); await bet(10); await forceRound(1, 1, 0); await button('押热门').click(); await button('开赛').click(); await advance(700);
  assert.equal(await page.locator('.pnl-header .value').evaluate(el => getComputedStyle(el).color), locale === 'en' ? 'rgb(211, 58, 53)' : 'rgb(21, 128, 61)');
  await button('下一轮').click(); await button('押热门').click(); await button('开赛').click(); await page.goto(`${base}/${locale}/casino/gacha/`);
  assert.equal(await page.locator('.next-link').getAttribute('href'), `/${locale}/casino/sports/`); await page.locator('.next-link').click(); await page.locator('[data-sports]').scrollIntoViewIfNeeded();
  await page.waitForFunction(() => !document.querySelector('astro-island[ssr]') && document.querySelector('.sp-match')); await advance(2000); await expectCounts(0, 0);
  await page.goto(`${base}/${locale}/casino/`); assert.equal(await page.locator(`a[href="/${locale}/casino/sports/"]`).count(), 1);
  assert.deepEqual(errors, []);
  reports.push({ locale, status: 'passed', checks: ['manual Home/Draw/Away and keyboard', 'true-probability toggle', 'partial score disclosure', 'whole-slip accounting', 'immutable settled stake', '1/10/100 bets', '1/2/4/8 legs', '10/100/1000 stakes', '100-round skip', 'auto stop and latest config', 'reset/unmount timers', 'skip during auto pause', 'English full templates and plurals', 'locale currency and loss colors', '390/640 layout and 44px targets', 'static numbers/highlight', 'navigation'] });
  await page.close();
}
await writeFile('qa-output/g9-browser-results.json', JSON.stringify(reports, null, 2) + '\n'); console.log(JSON.stringify(reports, null, 2));
} finally { await browser.close(); }
