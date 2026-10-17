/** 浏览器验收：DeepSeek D24–D28 的五个组件（目录按钮、赔率拆解器、押注次数账本、红黑序列检测器、分享）。
 * 用法：node tools/check_ds_widgets.mjs http://127.0.0.1:4321
 * 可选环境变量：PLAYWRIGHT_MODULE_PATH、BROWSER_EXECUTABLE_PATH
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const base = (process.argv[2] || 'http://127.0.0.1:4321').replace(/\/$/, '');
const out = 'qa-output/screenshots';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.BROWSER_EXECUTABLE_PATH || undefined,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
});

/** 打开页面；返回 page 和收集到的报错 */
async function open(locale, path) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: base });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/net::|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await page.goto(`${base}/${locale}/${path}`, { waitUntil: 'networkidle' });
  return { page, errors, context };
}

/** 把 client:visible 的组件滚进视口并等它水合完成 */
async function hydrate(page, selector) {
  await page.locator(selector).first().scrollIntoViewIfNeeded();
  await page.waitForFunction(sel => {
    const el = document.querySelector(sel);
    const island = el?.closest('astro-island');
    return el && island && !island.hasAttribute('ssr');
  }, selector, { timeout: 10000 });
}

const text = (page, sel) => page.locator(sel).first().innerText();
const overflow = page => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

for (const locale of ['zh', 'en']) {
  const zh = locale === 'zh';

  /* D24 目录按钮 */
  {
    const { page, errors, context } = await open(locale, 'ch2/');
    const button = page.locator('#toc-button');
    const panel = page.locator('#toc-panel');
    assert.equal(await panel.isHidden(), true, 'toc panel starts hidden');
    await button.click();
    assert.equal(await button.getAttribute('aria-expanded'), 'true');
    assert.equal(await panel.isVisible(), true, 'toc panel opens');
    assert.equal(await panel.locator('a').count(), 11);
    assert.equal(await page.evaluate(() => document.activeElement?.closest('#toc-panel') !== null), true, 'focus moves into the panel');
    const current = panel.locator('a[aria-current="page"]');
    assert.equal(await current.count(), 1, 'exactly one current page');
    assert.match(await current.getAttribute('href'), /\/ch2\/$/);
    await page.screenshot({ path: `${out}/ds-toc-${locale}.png` });
    await page.keyboard.press('Escape');
    assert.equal(await panel.isHidden(), true, 'Esc closes');
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'toc-button', 'focus returns to the button');
    await button.click();
    await page.mouse.click(200, 800);
    assert.equal(await panel.isHidden(), true, 'click outside closes');
    assert.equal(await overflow(page), 0);
    assert.deepEqual(errors, []);
    await context.close();
  }

  /* D27 赔率拆解器 + 八种押法表 */
  {
    const { page, errors, context } = await open(locale, 'part2/roulette/');
    await hydrate(page, '.p2r-seg button');
    const values = () => page.locator('.p2r-bar-value').allInnerTexts();
    assert.deepEqual(await values(), zh ? ['37 倍', '35 倍'] : ['37×', '35×']);
    assert.match(await text(page, '.p2r-out .ch-body'), /5\.26%/);
    await page.locator('.p2r-seg button').nth(1).click();
    assert.equal(await page.locator('.p2r-seg button').nth(1).getAttribute('aria-pressed'), 'true');
    assert.deepEqual(await values(), zh ? ['6.6 倍', '6 倍'] : ['6.6×', '6×']);
    assert.match(await text(page, '.p2r-out .ch-body'), /0\.6.*7\.89%/s);
    const share = await page.evaluate(() => {
      const paid = document.querySelector('.p2r-bar-paid').getBoundingClientRect().width;
      const all = document.querySelector('.p2r-bar-actual').getBoundingClientRect().width;
      return paid / all;
    });
    assert.ok(Math.abs(share - 6 / 6.6) < 0.01, `blue part ${share}`);
    await page.locator('.p2r-out').screenshot({ path: `${out}/ds-payout-${locale}.png` });
    const rows = await page.locator('.p2r-row-value').allInnerTexts();
    assert.deepEqual(rows, ['5.26%', '5.26%', '5.26%', '5.26%', '7.89%', '5.26%', '5.26%', '5.26%']);
    assert.equal(await page.locator('.p2r-row.is-worst').count(), 1);
    assert.equal(await overflow(page), 0);
    assert.deepEqual(errors, []);
    await context.close();
  }

  /* D26 押注次数账本 + 内华达数字 */
  {
    const { page, errors, context } = await open(locale, 'part4/house/');
    await hydrate(page, '#p4r-turn');
    const ledger = () => page.locator('.p4r-row-val').allInnerTexts();
    const cards = () => page.locator('.p4r-card-value').allInnerTexts();
    assert.deepEqual(await ledger(), ['100', '1,000', '10.6']);
    assert.deepEqual(await cards(), ['1.06%', '10.6%']);
    assert.equal(await text(page, '.p4r-slider-value'), zh ? '10 次' : '10 times');
    await page.locator('#p4r-turn').evaluate(el => { el.value = '30'; el.dispatchEvent(new Event('input', { bubbles: true })); });
    assert.deepEqual(await ledger(), ['100', '3,000', '31.7']);
    assert.deepEqual(await cards(), ['1.06%', '31.7%']);
    await page.locator('#p4r-turn').evaluate(el => { el.value = '1'; el.dispatchEvent(new Event('input', { bubbles: true })); });
    assert.equal(await text(page, '.p4r-slider-value'), zh ? '1 次' : '1 time');
    assert.deepEqual(await page.locator('.p4r-big-value').allInnerTexts(), ['$937.1M', '$346.1M']);
    assert.equal(await text(page, '.p4r-months-num'), '55');
    assert.deepEqual(await page.locator('.p4r-change-val').allInnerTexts(), ['8.8% → 8.0%', '15.1% → 12.1%', '17.10% → 8.49%']);
    await page.locator('.p4r-calc').screenshot({ path: `${out}/ds-ledger-${locale}.png` });
    assert.equal(await overflow(page), 0);
    assert.deepEqual(errors, []);
    await context.close();
  }

  /* D28 红黑序列检测器 + A/B 统计 */
  {
    const { page, errors, context } = await open(locale, 'part3/psych/');
    assert.deepEqual(await page.locator('.p3p-stats-val').allInnerTexts(), ['2', '6', '31', '18']);
    await hydrate(page, '.p3p-choice.is-red');
    const red = page.locator('.p3p-choice.is-red');
    const black = page.locator('.p3p-choice.is-black');
    assert.equal(await page.locator('.p3p-pill.is-empty').count(), 20, 'starts empty');
    for (let i = 0; i < 20; i++) await (i % 2 ? black : red).click();
    assert.equal(await red.isDisabled(), true, 'buttons disabled at 20');
    const grid = await page.locator('.p3p-grid').getAttribute('aria-label');
    assert.equal(grid, zh ? '已编 20 局' : '20 rounds entered');
    const verdictEven = await text(page, '.p3p-verdict');
    assert.match(verdictEven, zh ? /太均匀/ : /too even/);
    assert.match(await text(page, '.p3p-result'), /9\.5/);
    await page.locator('.p3p-try').screenshot({ path: `${out}/ds-sequence-${locale}.png` });
    await page.locator('.p3p-tool').first().click();
    assert.equal(await page.locator('.p3p-verdict').count(), 0, 'undo hides the result');
    await page.locator('.p3p-tool').nth(1).click();
    for (let i = 0; i < 20; i++) await red.click();
    assert.match(await text(page, '.p3p-verdict'), zh ? /换色太少/ : /Too few switches/);
    assert.equal(await overflow(page), 0);
    assert.deepEqual(errors, []);
    await context.close();
  }

  /* D25 复制链接 + 分享图 */
  {
    const { page, errors, context } = await open(locale, 'ending/');
    await hydrate(page, '.end-actions .end-pill');
    const copy = page.locator('.end-actions .end-pill').first();
    await copy.click();
    await page.waitForFunction(() => /已复制|Copied/.test(document.querySelector('.end-actions .end-pill')?.textContent ?? ''));
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    assert.equal(clip, `https://wwwaywood1.github.io/long-run-lab/${locale}/`);
    await page.locator('.end-actions .end-pill').nth(1).click();
    await page.locator('.end-share-image').waitFor({ timeout: 15000 });
    const size = await page.locator('.end-share-image').evaluate(img => new Promise(res => {
      const done = () => res([img.naturalWidth, img.naturalHeight]);
      img.complete ? done() : img.addEventListener('load', done);
    }));
    assert.deepEqual(size, [1080, 1350]);
    assert.match(await page.locator('.end-share-image').getAttribute('alt'), /4\.5/);
    await page.locator('.end-share').screenshot({ path: `${out}/ds-share-${locale}.png` });
    assert.equal(await overflow(page), 0);
    assert.deepEqual(errors, []);
    await context.close();
  }
  console.log(`${locale}: D24–D28 ok`);
}
await browser.close();
