/** W1 / HouseCalculator: npm run preview, then node tools/check_house.mjs [base].
 * Install Playwright separately or set PLAYWRIGHT_MODULE_PATH.
 * All screenshots and QA reports stay in ignored qa-output/.
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { assertEnglish } from './qa-language.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const base = (process.argv[2] || 'http://127.0.0.1:4321').replace(/\/$/, '');
const out = 'qa-output';
await mkdir(`${out}/screenshots`, { recursive: true });
const data = JSON.parse(await readFile('data/numbers.json', 'utf8'));
const entries = JSON.parse(await readFile('i18n/source/Casino.json', 'utf8')).strings;
const games = ['roulette', 'sicbo', 'baccarat', 'slots', 'crash'];
const edges = [2 / 38, 6 / 216, 0.010579, data.slots.edge.value, 0.03];
const rph = [60, 60, 70, 600, 180];
const currency = (n, lang) => {
  const text = n < 100 && Math.abs(n - Math.round(n)) > .001 ? n.toFixed(n < 10 ? 2 : 1) : Math.round(n).toLocaleString('en-US');
  return lang === 'zh' ? `${text} 元` : `$${text}`;
};
const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE_PATH || undefined });
const report = [];
try {
  for (const locale of ['zh', 'en']) for (const width of [390, 640]) {
    const page = await browser.newPage({ viewport: { width, height: 844 }, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const t = id => entries.find(e => e.id === `Casino.${String(id).padStart(3, '0')}`)[locale];
    await page.goto(`${base}/${locale}/casino/`, { waitUntil: 'networkidle' });
    const calc = page.locator('[data-testid="house-calculator"]');
    await calc.scrollIntoViewIfNeeded();
    await page.waitForFunction(() => !document.querySelector('[data-testid="house-calculator"]').closest('astro-island').hasAttribute('ssr'));
    assert.equal(await calc.locator('[data-game="baccarat"]').getAttribute('aria-pressed'), 'true');
    assert.equal(await calc.locator('[data-bet="100"]').getAttribute('aria-pressed'), 'true');
    assert.equal(await calc.locator('.cas-house-big').innerText(), currency(59242.4, locale));
    assert.equal(await calc.locator('.cas-house-odd').innerText(), t(91));
    await page.screenshot({ path: `${out}/screenshots/house-${locale}-${width}-full.png`, fullPage: true });
    await calc.screenshot({ path: `${out}/screenshots/house-${locale}-${width}.png` });
    assert.equal(await calc.locator('[aria-live="polite"]').count(), 1);
    for (const button of await calc.locator('button').all()) {
      const box = await button.boundingBox();
      assert.ok(box.width >= 44 && box.height >= 44, JSON.stringify(box));
    }
    for (let i = 0; i < games.length; i++) {
      const button = calc.locator(`[data-game="${games[i]}"]`);
      await button.focus();
      await page.keyboard.press(i % 2 ? 'Space' : 'Enter');
      assert.equal(await button.getAttribute('aria-pressed'), 'true');
      assert.equal(await calc.locator('[data-game][aria-pressed="true"]').count(), 1);
      for (const bet of [10, 100, 1000]) {
        await calc.locator(`[data-bet="${bet}"]`).click();
        assert.equal(await calc.locator('[data-bet][aria-pressed="true"]').count(), 1);
        const mean = edges[i] * rph[i] * 8 * 100 * bet;
        assert.equal(await calc.locator('.cas-house-big').innerText(), currency(mean, locale));
        assert.equal(await calc.locator('.cas-house-per').innerText(), currency(mean / 100, locale));
        assert.equal(await calc.locator('.cas-house-odd').innerText(), t(i === 2 ? 91 : 86));
        assert.ok((await calc.locator('.cas-house-note').first().innerText()).includes(t([87, 89, 92, 94, 96][i])));
        await assertEnglish(page, locale);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
        assert.equal(overflow, false, `${locale} ${width} ${games[i]} ${bet}: page overflow`);
        for (const el of await calc.locator('.cas-house-big, .cas-house-row, .cas-seg').all())
          assert.equal(await el.evaluate(e => e.scrollWidth > e.clientWidth + 1), false, 'calculator overflow');
      }
    }
    const other = locale === 'zh' ? 'en' : 'zh';
    assert.ok(await page.locator(`.lang-switch a[href="/${other}/casino/"]`).count());
    await page.locator(`.lang-switch a[href="/${other}/casino/"]`).click();
    assert.equal(new URL(page.url()).pathname, `/${other}/casino/`);
    assert.deepEqual(errors, []);
    report.push({ locale, width, states: 15, keyboard: true, touchTargets: true, noOverflow: true, languageSwitch: true, errors });
    await page.close();
  }
  await writeFile(`${out}/house-report.json`, JSON.stringify(report, null, 2) + '\n');
  console.log('HouseCalculator: 60 states passed, zh/en × 390/640px; keyboard, layout, copy and screenshots checked.');
} finally { await browser.close(); }
