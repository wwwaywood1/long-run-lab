/** 浏览器验收：第 4 章“选一种下注方法”（W4 MartingaleLab）。
 * 用法：node tools/check_ch4.mjs http://127.0.0.1:4321
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

for (const locale of ['zh', 'en']) {
  const zh = locale === 'zh';
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/net::|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await page.goto(`${base}/${locale}/ch4/`, { waitUntil: 'networkidle' });
  const lab = page.locator('.p4m-lab');
  await lab.scrollIntoViewIfNeeded();
  await page.waitForFunction(() => {
    const island = document.querySelector('.p4m-lab')?.closest('astro-island');
    return island && !island.hasAttribute('ssr');
  });

  // 默认画面：倍投、82 轮 +820、第 83 轮 −1,270
  const pressed = () => page.locator('.p4m-seg button[aria-pressed="true"]').innerText();
  assert.equal(await pressed(), zh ? '倍投' : 'Doubling');
  const svg = await lab.locator('svg').innerHTML();
  assert.match(svg, /−1,270/);
  assert.match(svg, zh ? /82 轮 \+820/ : /82 rounds \+820/);
  assert.match(svg, zh ? /第 83 轮/ : /Round 83/);
  assert.match(await lab.locator('.ch-body').innerText(), zh ? /连赢 82 轮/ : /82 rounds won/);
  // 右端标签不能被裁掉：整段文字都在图内
  const clipped = await lab.locator('svg').evaluate(el => {
    const box = el.getBoundingClientRect();
    return [...el.querySelectorAll('text')].some(t => { const r = t.getBoundingClientRect(); return r.right > box.right + 0.5 || r.left < box.left - 0.5; });
  });
  assert.equal(clipped, false, 'chart labels stay inside the figure');
  await lab.screenshot({ path: `${out}/ch4-story-${locale}.png` });

  // 四种方法都能切换，并给出一次模拟结果
  for (const [i, unit] of [[0, zh ? '局' : 'Spin'], [2, zh ? '局' : 'Spin'], [3, zh ? '局' : 'Spin'], [1, zh ? '轮' : 'Round']]) {
    await page.locator('.p4m-seg button').nth(i).click();
    assert.equal(await page.locator('.p4m-seg button').nth(i).getAttribute('aria-pressed'), 'true');
    assert.match(await lab.locator('.ch-body').innerText(), zh ? /这一次：下了 [\d,]+ 注/ : /This time: [\d,]+ bets/);
    assert.match(await lab.locator('svg text').last().textContent(), new RegExp(unit));
  }

  // 一万次汇总：每押 100 元平均亏约 5.26
  await page.locator('.p4m-seg button').nth(0).click();
  await page.locator('.p4m-btn.is-solid').click();
  const summary = await lab.locator('.p4m-summary').innerText();
  const per100 = Number(summary.match(zh ? /平均亏 ([\d.]+) 元/ : /\$([\d.]+) lost per/)[1]);
  assert.ok(Math.abs(per100 - 5.26) < 0.6, `per100 ${per100}`);
  await lab.screenshot({ path: `${out}/ch4-flat-${locale}.png` });

  // 第 03 段的数字
  const pcts = await page.locator('.p4m-pct').allInnerTexts();
  assert.deepEqual(pcts, ['98.88%', '1.12%']);
  assert.equal(await page.locator('.p4m-avg').innerText(), zh ? '−4.32 元' : '−$4.32');

  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0);
  assert.deepEqual(errors, []);
  await page.close();
  console.log(`${locale}: ch4 ok`);
}
await browser.close();
