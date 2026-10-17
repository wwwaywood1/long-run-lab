/** Browser acceptance for G8. Run against npm run dev or preview.
 * Optional PLAYWRIGHT_MODULE_PATH, BROWSER_EXECUTABLE_PATH and QA_FONTS_ROOT.
 */
import assert from 'node:assert/strict';
import { assertEnglish, translator } from './qa-language.mjs';
import { createRequire } from 'node:module';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const base = (process.argv[2] || 'http://127.0.0.1:4321').replace(/\/$/, '');
const out = 'qa-output/screenshots';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE_PATH || undefined,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });
const reports = [];
try {
for (const locale of ['zh', 'en']) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    let seed = 20261017;
    Math.random = () => {
      if (window.__gachaRandomQueue?.length) return window.__gachaRandomQueue.shift();
      let t = seed += 0x6d2b79f5;
      t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  });
  if (process.env.QA_FONTS_ROOT) {
    const root = process.env.QA_FONTS_ROOT;
    let css = '';
    for (const [family, weights] of [['noto-sans-sc', [400, 500, 700]], ['noto-serif-sc', [700, 900]], ['ibm-plex-mono', [500, 600]]]) {
      for (const weight of weights) css += (await readFile(path.join(root, family, `${weight}.css`), 'utf8')).replaceAll('./files/', `https://qa-fonts.local/${family}/files/`);
    }
    await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ contentType: 'text/css', body: css }));
    await page.route('https://qa-fonts.local/**', async route => route.fulfill({ contentType: 'font/woff2', body: await readFile(path.join(root, new URL(route.request().url()).pathname.slice(1))), headers: { 'Access-Control-Allow-Origin': '*' } }));
  }
  await page.goto(`${base}/${locale}/casino/gacha/`);
  await page.locator('[data-gacha]').scrollIntoViewIfNeeded();
  await page.waitForFunction(() => !document.querySelector('astro-island[ssr]'));
  await page.evaluate(() => document.fonts.ready); await page.clock.install();
  const tr = translator(locale, 'Gacha');
  const button = zh => page.getByRole('button', { name: tr(zh), exact: true });
  const pick = async n => page.getByRole('group', { name: tr('几位玩家'), exact: true }).getByRole('button', { name: n === 1 ? tr('只看我') : locale === 'en' ? `${n} players` : `${n} 人`, exact: true }).click();
  const force = async values => page.evaluate(values => { window.__gachaRandomQueue = values; }, values);
  const assertCny = async () => {
    assert.doesNotMatch(await page.locator('[data-gacha]').innerText(), /\$/);
    for (const text of await page.locator('.pnl-header .value, .gc-average > strong').allInnerTexts()) if (text !== '—') assert.match(text, locale === 'en' ? /yuan$/ : /元$/);
  };
  const advance = async ms => { await page.clock.runFor(ms); await assertEnglish(page, locale); await assertCny(); };
  const stats = async () => {
    const text = await page.locator('[data-stats]').innerText();
    const values = text.match(/[\d,]+/g).map(s => Number(s.replaceAll(',', '')));
    // "50/50" and "4-star" contain digits too; match the complete English sentence.
    if (locale === 'zh') return values;
    const m = text.match(/^([\d,]+) pulls? · ([\d,]+) limited cards? · ([\d,]+) lost 50\/50s? · ([\d,]+) 4-stars?$/);
    assert.ok(m, text); return m.slice(1).map(s => Number(s.replaceAll(',', '')));
  };
  const expectStats = async expected => assert.deepEqual(await stats(), expected);
  const spent = async () => Number((await page.locator('.pnl-header .value').innerText()).replace(/[^\d]/g, ''));
  const reset = async () => { await button('重来').click(); await expectStats([0, 0, 0, 0]); };
  const screenshot = async name => {
    await assertEnglish(page, locale); await assertCny();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: `${out}/gacha-${locale}-${name}.png`, fullPage: true, animations: 'disabled' });
  };
  const touch = async () => assert.deepEqual(await page.locator('button, .lang-switch a').evaluateAll(nodes => nodes.filter(n => {
    const r = n.getBoundingClientRect(); return r.width > 0 && r.height > 0 && (r.width < 44 || r.height < 44);
  }).map(n => ({ text: n.textContent, width: n.getBoundingClientRect().width, height: n.getBoundingClientRect().height }))), []);
  const other = locale === 'zh' ? 'en' : 'zh';
  assert.equal(await page.locator(`.lang-switch a[lang="${other}"]`).getAttribute('href'), `/${other}/casino/gacha/`);
  assert.equal(await page.locator('.site-footer a').getAttribute('href'), `/${locale}/casino/`);
  assert.equal(await page.locator('.next-link').getAttribute('href'), `/${locale}/casino/sports/`);
  assert.equal(await page.locator('.gc-reveal .big').innerText(), '93');
  assert.equal(await page.locator('.gc-distribution rect').count(), 9);
  assert.equal(await page.locator('.gc-share > strong').innerText(), '64%');
  assert.equal(await page.locator('.gc-body mark').count(), 1);
  assert.equal(await page.locator('.gc-law .gc-statement em').innerText(), '0');
  await expectStats([0, 0, 0, 0]);
  assert.equal(await page.locator('.gc-card[aria-label]').count(), 0);
  await touch(); await screenshot('390'); await page.setViewportSize({ width: 640, height: 844 }); await touch(); await screenshot('640'); await page.setViewportSize({ width: 390, height: 844 });
  // Single pull: keyboard, staggered disclosure, loss color and CNY conversion.
  await force([0, 0]); await button('单抽 · 16 元').focus(); await page.keyboard.press('Enter');
  assert.equal(await button('十连 · 160 元').isDisabled(), true);
  assert.equal(await page.locator('.gc-card[aria-label]').count(), 0);
  await advance(400); await expectStats([1, 1, 0, 0]); assert.equal(await spent(), 16);
  assert.equal(await page.locator('.gc-card.kind-F').count(), 1);
  assert.equal(await page.locator('.gc-banner > strong').innerText(), tr('出了限定！'));
  assert.equal(await page.locator('.pnl-header .value').evaluate(el => getComputedStyle(el).color), await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--loss').trim()).then(hex => { const h = hex.slice(1); return `rgb(${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(h.slice(4, 6), 16)})`; }));
  await screenshot('390-featured');
  await force([0, .99]); await button('单抽 · 16 元').click(); await advance(400); await expectStats([2, 1, 1, 0]);
  assert.equal(await page.locator('[data-guarantee]').innerText(), tr('大保底：下一个五星必是限定'));
  assert.equal(await page.locator('.gc-banner > strong').innerText(), tr('金光！但歪了'));
  if (locale === 'en') assert.equal(await page.locator('.loss-conversion-inline').innerText(), '≈ 1 bubble tea');
  await screenshot('390-off');
  await force([0]); await button('单抽 · 16 元').click(); await advance(400); await expectStats([3, 2, 1, 0]);
  assert.equal(await page.locator('[data-guarantee]').innerText(), tr('小保底：下一个五星有一半概率是限定'));
  // Ten cards reveal one by one. Reset cancels all still pending callbacks.
  await reset(); await force(Array(19).fill(.999999)); await button('十连 · 160 元').click();
  await advance(60); await expectStats([1, 0, 0, 0]); assert.equal(await page.locator('.gc-flipped').count(), 1);
  await advance(70); await expectStats([2, 0, 0, 0]); assert.equal(await page.locator('.gc-flipped').count(), 2);
  await screenshot('390-flipping');
  await advance(1000); await expectStats([10, 0, 0, 1]); assert.equal(await spent(), 160);
  assert.equal(await page.locator('.gc-card.kind-4').count(), 1); assert.equal(await page.locator('.gc-card.kind-3').count(), 9);
  assert.equal(await page.getByRole('progressbar', { name: tr('距离保底') }).first().getAttribute('aria-valuenow'), '10');
  if (locale === 'en') assert.equal(await page.locator('.loss-conversion-inline').innerText(), '≈ 3 movie tickets');
  await screenshot('390-ten');
  await force(Array(19).fill(.999999)); await button('十连 · 160 元').click(); await advance(130); await reset(); await advance(2000); await expectStats([0, 0, 0, 0]); assert.equal(await page.locator('.gc-card[aria-label]').count(), 0);
  // Pity progress at 80, soft-pity highlight, and then hard pity at 90 with a 50/50 loss.
  await force(Array(800).fill(.999999));
  for (let i = 0; i < 8; i++) { await button('十连 · 160 元').click(); await advance(1100); }
  await expectStats([80, 0, 0, 8]); assert.equal(await spent(), 1280);
  assert.equal(await page.locator('.gc-pity-track i.soft').count(), 1); await screenshot('390-soft-pity');
  await button('十连 · 160 元').click(); await advance(1100); await expectStats([90, 0, 1, 8]);
  assert.equal(await page.getByRole('progressbar', { name: tr('距离保底') }).first().getAttribute('aria-valuenow'), '0');
  assert.equal(await page.locator('[data-guarantee]').innerText(), tr('大保底：下一个五星必是限定'));
  // Until honors that guarantee, charges only 90 further pulls and displays the final ten.
  await button('一直抽到限定').click(); await advance(1100); await expectStats([180, 1, 1, 16]); assert.equal(await spent(), 2880);
  assert.equal(await page.locator('.gc-banner > strong').innerText(), locale === 'en' ? 'It took 90 pulls to get the limited card' : '抽了 90 抽才出限定');
  assert.equal(await page.locator('.gc-banner > span').innerText(), locale === 'en' ? 'This one cost 1,440 yuan' : '这一张花了 1,440 元');
  assert.equal(await page.locator('.gc-card[aria-label]').count(), 10); await screenshot('390-until');
  await reset(); await force([0, 0]); await button('一直抽到限定').click(); await advance(400); await expectStats([1, 1, 0, 0]);
  assert.equal(await page.locator('.gc-banner > strong').innerText(), locale === 'en' ? 'It took 1 pull to get the limited card' : '抽了 1 抽才出限定');
  // Independent multiplayer batches; selecting a mode starts a fresh group.
  await force(Array(4000).fill(.999999)); await pick(10);
  assert.equal(await button('换一批人再抽').isDisabled(), true);
  await advance(600); assert.equal(await page.locator('.gc-bar-row').count(), 10);
  assert.equal(await page.locator('.gc-bar-track i.high').count(), 10);
  assert.equal(await page.locator('.gc-average > strong').innerText(), locale === 'en' ? '2,880 yuan' : '2,880 元');
  await touch(); await screenshot('390-ten-players');
  await force(Array(20).fill(0)); await button('换一批人再抽').click(); await advance(600);
  assert.equal(await page.locator('.gc-bar-track i.low').count(), 10);
  assert.equal(await page.locator('.gc-average > strong').innerText(), locale === 'en' ? '16 yuan' : '16 元');
  await force([]); await pick(100); await advance(600);
  assert.equal(await page.locator('.gc-cost-cell').count(), 100);
  for (const band of ['low', 'middle', 'high']) assert.ok(await page.locator(`.gc-cost-cell.${band}`).count() > 0);
  await touch(); await screenshot('390-hundred-players');
  await page.setViewportSize({ width: 640, height: 844 }); await screenshot('640-hundred-players'); await page.setViewportSize({ width: 390, height: 844 });
  await button('换一批人再抽').click(); await button('清空').click(); await advance(1000);
  assert.equal(await page.locator('.gc-cost-cell').count(), 0); assert.equal(await page.locator('.gc-average > strong').innerText(), '—');
  assert.equal(await page.locator('[data-group-range]').innerText(), tr('点下面的按钮开始'));
  await button('换一批人再抽').click(); await advance(600); assert.equal(await page.locator('.gc-cost-cell').count(), 100);
  await pick(1); await expectStats([0, 0, 0, 0]); // Clear follows the original global reset behavior.
  await force([0, 0]); await button('单抽 · 16 元').click(); await advance(400);
  await force(Array(20).fill(0)); await pick(10); await advance(600); await pick(1); await expectStats([1, 1, 0, 0]); // Mode switches preserve the personal player.
  await button('十连 · 160 元').click(); await page.goto(`${base}/${locale}/casino/scratch/`); // Unmount during pending flips.
  assert.equal(await page.locator('.next-link').getAttribute('href'), `/${locale}/casino/gacha/`);
  await page.locator('.next-link').click(); await page.locator('[data-gacha]').scrollIntoViewIfNeeded(); await page.waitForFunction(() => !document.querySelector('astro-island[ssr]'));
  await advance(1500); await expectStats([0, 0, 0, 0]);
  await page.goto(`${base}/${locale}/casino/`);
  assert.equal(await page.locator(`a[href="/${locale}/casino/gacha/"]`).count(), 1);
  assert.deepEqual(errors, []);
  reports.push({ locale, status: 'passed', checks: ['single/ten/until', 'keyboard', 'staggered flip accounting', 'CNY and conversion', 'soft/hard pity', '50/50 guarantee', 'reset/unmount timer cleanup', '1/10/100 player modes', 'fresh group reruns', 'cost bands', 'clear', 'mode preservation', 'localized emphasis', '390/640 layout', '44px targets', 'navigation', 'English text and accessible names'] });
  await page.close();
}
await writeFile('qa-output/g8-browser-results.json', JSON.stringify(reports, null, 2) + '\n');
console.log(JSON.stringify(reports, null, 2));
} finally { await browser.close(); }
