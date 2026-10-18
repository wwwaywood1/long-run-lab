/** 浏览器验收：研究层 · 公平检测器页（DetectorLab、FalseAlarmGrid）和 404 页。
 * 用法：node tools/check_detector.mjs http://127.0.0.1:4321
 * 可选环境变量：PLAYWRIGHT_MODULE_PATH、BROWSER_EXECUTABLE_PATH
 * 页面里的 Math.random 换成固定种子的 mulberry32，每次运行结果相同。
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

const SEEDED_RANDOM = () => {
  let a = 20261017 >>> 0;
  Math.random = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

async function open(path) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript(SEEDED_RANDOM);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/net::|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await page.goto(`${base}/${path}`, { waitUntil: 'networkidle' });
  return { page, errors, context };
}
async function hydrate(page, selector) {
  await page.locator(selector).first().scrollIntoViewIfNeeded();
  await page.waitForFunction(sel => {
    const el = document.querySelector(sel);
    const island = el?.closest('astro-island');
    return el && island && !island.hasAttribute('ssr');
  }, selector, { timeout: 10000 });
}
const text = (page, sel) => page.locator(sel).first().innerText();
const svgText = (page, sel) => page.locator(sel).first().evaluate(el => el.textContent);
const overflow = page => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

for (const locale of ['zh', 'en']) {
  const zh = locale === 'zh';
  const { page, errors, context } = await open(`${locale}/research/detector/`);
  await hydrate(page, '.rd-lab');
  const lab = page.locator('.rd-lab');
  const modeBtn = i => lab.locator('.rd-mode-btn').nth(i);
  const tabBtn = i => lab.locator('.rd-tab').nth(i);
  const actions = lab.locator('.rd-actions button');
  const rounds = async () => Number((await text(page, '.rd-rounds')).match(/[\d,]+/)[0].replace(/,/g, ''));

  /* 初始状态：不告诉我、它公平吗、第 0 局、E = 1.00、没有曲线 */
  assert.equal(await modeBtn(3).getAttribute('aria-pressed'), 'true');
  assert.equal(await tabBtn(0).getAttribute('aria-pressed'), 'true');
  assert.equal(await text(page, '.rd-stat-value'), '1.00');
  assert.equal(await text(page, '.rd-rounds'), zh ? '第 0 局 · 你的胜率 —（公平应为 47.4%）' : 'Round 0 · your win rate — (fair would be 47.4%)');
  assert.equal(await text(page, '.rd-alert'), zh ? '还没开始。押几局看看证据怎么变化。' : 'Nothing yet. Bet a few rounds and watch how the evidence moves.');
  assert.equal(await lab.locator('.rd-path').count(), 0);
  assert.equal(await svgText(page, '.rd-xmax'), zh ? '200 局' : '200 rounds');

  /* 押一局 */
  await actions.nth(0).click();
  assert.equal(await rounds(), 1);
  assert.equal(await lab.locator('.rd-path').count(), 1);
  assert.match(await text(page, '.rd-rounds'), /(0\.0|100\.0)%/);

  /* 动了手脚：快进到 e 值报警 */
  await modeBtn(1).click();
  assert.equal(await modeBtn(1).getAttribute('aria-pressed'), 'true');
  assert.equal(await rounds(), 0, 'switching mode starts a new table');
  assert.match(await text(page, '.rd-mode-note'), /42%/);
  for (let i = 0; i < 40 && !(await lab.locator('.rd-alert.is-alarm').count()); i++) await actions.nth(2).click();
  assert.equal(await lab.locator('.rd-alert.is-alarm').count(), 1, 'rigged table eventually alarms');
  const alarmText = await text(page, '.rd-alert');
  assert.match(alarmText, zh ? /^第 [\d,]+ 局报警：有充分证据表明这张桌子被动了手脚。/ : /^Alarm at round [\d,]+: enough evidence that this table has been rigged\./);
  const alarmRound = Number(alarmText.match(/[\d,]+/)[0].replace(/,/g, ''));
  assert.ok(alarmRound <= await rounds());
  assert.equal(await lab.locator('.rd-alarm-dot').count(), 1);
  assert.equal(await lab.locator('.rd-stat-value.is-alarm').count(), 1);
  assert.ok(Number((await text(page, '.rd-stat-value')).replace(/,/g, '')) >= 20, 'E is past the alarm line');
  const xmax = Number((await svgText(page, '.rd-xmax')).match(/[\d,]+/)[0].replace(/,/g, ''));
  assert.equal(xmax, Math.max(200, await rounds()));
  await lab.screenshot({ path: `${out}/detector-lab-${locale}.png` });

  /* 换到“它什么时候变的？”：R、报警线 1,000、没有 p 值的圆圈图例 */
  await tabBtn(1).click();
  assert.equal(await text(page, '.rd-stat-label'), zh ? '变点统计量 R：每局都重新押“从这里开始变了”' : 'Change statistic R: a fresh bet each round on “the change starts here”');
  assert.equal(await text(page, '.rd-stat-thr'), zh ? '报警线 1,000' : 'Alarm line 1,000');
  assert.equal(await lab.locator('.rd-legend-item').count(), 2);
  await tabBtn(0).click();

  /* 揭晓真相 */
  await actions.nth(3).click();
  assert.equal(await text(page, '.rd-truth'), zh ? '真相：胜率被调到了 42%。' : 'The truth: the win rate was lowered to 42%.');

  /* 先放水再动手：揭晓后才画“开始动手”的竖线 */
  await modeBtn(2).click();
  assert.equal(await lab.locator('.rd-truth').count(), 0, 'new table hides the truth');
  for (let i = 0; i < 3; i++) await actions.nth(2).click();
  assert.equal(await rounds(), 300);
  assert.equal(await lab.locator('text=' + (zh ? '开始动手' : 'Rigging starts')).count(), 0);
  await actions.nth(3).click();
  assert.equal(await lab.locator('svg text', { hasText: zh ? '开始动手' : 'Rigging starts' }).count(), 1);
  assert.match(await text(page, '.rd-truth'), /55%.*42%/);

  /* 自动押：按钮变“停下”，局数在涨；再点停下 */
  await modeBtn(0).click();
  await actions.nth(1).click();
  assert.equal(await actions.nth(1).getAttribute('aria-pressed'), 'true');
  assert.equal(await actions.nth(1).innerText(), zh ? '停下' : 'Stop');
  await page.waitForFunction(() => Number(document.querySelector('.rd-rounds').textContent.match(/[\d,]+/)[0].replace(/,/g, '')) >= 30);
  await actions.nth(1).click();
  assert.equal(await actions.nth(1).getAttribute('aria-pressed'), 'false');
  const stopped = await rounds();
  await page.waitForTimeout(300);
  assert.equal(await rounds(), stopped, 'auto really stopped');
  assert.ok(stopped > 0);

  /* 换一张桌子 */
  await lab.locator('.rd-btn-new').click();
  assert.equal(await rounds(), 0);
  assert.equal(await text(page, '.rd-stat-value'), '1.00');

  /* 误报方格 */
  await hydrate(page, '.rd-run');
  assert.deepEqual(await page.locator('.rd-mc-count').allInnerTexts(), ['—', '—']);
  await page.locator('.rd-run').click();
  const counts = (await page.locator('.rd-mc-count').allInnerTexts()).map(Number);
  for (const [i, key] of ['naive', 'e'].entries()) {
    assert.equal(await page.locator(`.rd-mc-cell[data-group="${key}"] .rd-square`).count(), 100);
    assert.equal(await page.locator(`.rd-mc-cell[data-group="${key}"] .rd-square.is-hit`).count(), counts[i]);
  }
  assert.ok(counts[0] > counts[1], `p-value peeking flags more fair tables (${counts})`);
  assert.ok(counts[0] >= 20 && counts[1] <= 15, `counts in a plausible range (${counts})`);
  await page.locator('.rd-mc').screenshot({ path: `${out}/detector-grid-${locale}.png` });

  assert.equal(await overflow(page), 0);
  assert.deepEqual(errors, []);
  await context.close();
  console.log(`${locale}: detector ok`);
}

/* 404 页：不收录；语言切换指向两个首页；四个按钮都通 */
{
  const { page, errors, context } = await open('no/such/page/');
  assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'), 'noindex');
  assert.equal(await page.locator('link[rel="alternate"]').count(), 0);
  const hrefs = await page.locator('.lang-switch a').evaluateAll(as => as.map(a => a.getAttribute('href')));
  assert.ok(hrefs[0].endsWith('/zh/') && hrefs[1].endsWith('/en/'), hrefs.join(' '));
  const buttons = await page.locator('.nf-btn').evaluateAll(as => as.map(a => a.getAttribute('href')));
  assert.equal(buttons.length, 4);
  for (const href of buttons) {
    const res = await page.request.get(new URL(href, base).toString());
    assert.equal(res.status(), 200, href);
  }
  assert.equal(await page.locator('section[lang="en"] h2').innerText(), 'No page\nin this pocket.');
  assert.equal(await overflow(page), 0);
  assert.deepEqual(errors.filter(e => !/404/.test(e)), []);
  await page.screenshot({ path: `${out}/404.png`, fullPage: true });
  await context.close();
  console.log('404 ok');
}
await browser.close();
