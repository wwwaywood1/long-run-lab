/** 第 3 章样板页检查：两种语言的整页截图、选择题、计算器（含换筹码后的对齐）、无控制台错误。
 * node tools/check_ch3.mjs http://127.0.0.1:4321
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const base = (process.argv[2] || 'http://127.0.0.1:4321').replace(/\/$/, '');
const out = 'qa-output/screenshots';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE_PATH || undefined, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });
try {
  for (const locale of ['zh', 'en']) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && !m.text().includes('net::')) errors.push(m.text()); }); // 沙盒里连不上字体 CDN，不算页面错误
    await page.goto(`${base}/${locale}/ch3/`, { waitUntil: 'networkidle' });
    await page.screenshot({ path: `${out}/ch3-${locale}-full.png`, fullPage: true });
    // 选择题：选第一个（错的），正确答案被标出、其余锁定
    const options = page.locator('.ch-option');
    await options.first().scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await options.first().click();
    await page.waitForTimeout(100);
    assert.equal(await options.nth(2).getAttribute('class').then(c => c.includes('is-answer')), true);
    assert.match(await page.locator('.ch-feedback').innerText(), locale === 'zh' ? /没猜中/ : /Not quite/);
    await options.nth(1).dispatchEvent('click'); // 已锁定（aria-disabled），点了也不变
    assert.equal(await options.nth(1).getAttribute('aria-checked'), 'false');
    // 计算器默认值（client:visible：先滚到可见处，等它激活）
    await page.locator('.ruin-calc').scrollIntoViewIfNeeded();
    await page.waitForFunction(() => !document.querySelector('.ruin-calc')?.closest('astro-island')?.hasAttribute('ssr'));
    const big = page.locator('.ruin-big');
    assert.equal(await big.nth(0).innerText(), '0.0027%');
    assert.equal(await big.nth(1).innerText(), '99.997%');
    // 换成每注 100：一把押上
    await page.locator('#ruin-bet').fill('7');
    await page.waitForTimeout(100);
    assert.equal(await big.nth(0).innerText(), '47.4%');
    // 换成每注 25，再把本金拉到 110：应对齐到 25 的倍数
    await page.locator('#ruin-bet').fill('5');
    // 滑块只能停在 25 的倍数上；直接写 110 模拟拖动，浏览器会把它吸附到最近的刻度
    await page.locator('#ruin-bank').evaluate(el => { el.value = '110'; el.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.waitForTimeout(100);
    const bank = await page.locator('.ruin-value').first().innerText();
    assert.ok(['100 元', '125 元', '$100', '$125'].includes(bank), bank);
    await page.locator('.ruin-calc').screenshot({ path: `${out}/ch3-${locale}-calc.png` });
    assert.deepEqual(errors, []);
    console.log(locale, 'ok');
    await page.close();
  }
} finally { await browser.close(); }
