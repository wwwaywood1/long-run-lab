/** W2 browser QA. Start npm run preview; install Playwright separately or use
 * PLAYWRIGHT_MODULE_PATH / BROWSER_EXECUTABLE_PATH. Outputs stay in qa-output/.
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { assertEnglish } from './qa-language.mjs';
const require=createRequire(import.meta.url);
const { chromium }=require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const base=(process.argv[2]||'http://127.0.0.1:4321').replace(/\/$/,'');
const out='qa-output/w2';
await mkdir(out,{recursive:true});
const data=JSON.parse(await readFile('data/numbers.json','utf8'));
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE_PATH||undefined});
const reports=[];
try {
  for(const locale of ['zh','en']) for(const width of [390,640]) {
    const page=await browser.newPage({viewport:{width,height:844},reducedMotion:'reduce'});
    const errors=[]; page.on('pageerror',e=>errors.push(e.message));
    await page.goto(`${base}/${locale}/prologue/`,{waitUntil:'networkidle'});
    const widget=page.locator('[data-testid="house-ledger"]');
    await widget.scrollIntoViewIfNeeded();
    await page.waitForFunction(()=>!document.querySelector('[data-testid="house-ledger"]').closest('astro-island').hasAttribute('ssr'));
    const amount=widget.locator('.pl-amount-value'), curve=widget.locator('.pl-path'), band=widget.locator('.pl-band');
    const check=async()=>{
      await assertEnglish(page,locale);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      assert.equal(await widget.locator('[data-view][aria-pressed="true"]').count(),1);
      assert.equal(await widget.locator('[aria-live="polite"]').count(),1);
      for(const el of await widget.locator('button').all()) {const b=await el.boundingBox();assert.ok(b.width>=44 && b.height>=44);}
      assert.doesNotMatch(await curve.getAttribute('d'),/NaN|Infinity/);
    };
    assert.equal(await widget.getAttribute('data-view'),'house');
    assert.equal(await amount.getAttribute('data-value'),'46900');
    assert.equal(await amount.innerText(),locale==='zh'?'46,900 元':'$46,900');
    assert.equal(await widget.locator('svg text').last().textContent(),locale==='zh'?'第 100,000 局':'Round 100,000');
    const defaultPath=await curve.getAttribute('d');
    assert.equal((defaultPath.match(/L/g)||[]).length,100);
    const revealed=await page.locator('.pl-prob').innerText();
    assert.equal(revealed,'0.'+'0'.repeat(61)+'13');
    assert.ok((await page.locator('.pl-months-num').innerText()).includes(String(data.facts.nevada_sep_2025.consecutive_months)));
    await check();
    await page.screenshot({path:`${out}/ledger-${locale}-${width}-full.png`,fullPage:true});
    await widget.screenshot({path:`${out}/ledger-${locale}-${width}.png`});
    const guest=widget.locator('button[data-view="guest"]');
    await guest.focus(); await page.keyboard.press('Enter');
    assert.equal(await widget.getAttribute('data-view'),'guest');
    const guestAmount=await amount.getAttribute('data-value');
    assert.ok(Math.abs(Number(guestAmount))<=1000);
    assert.equal(await widget.locator('svg text').last().textContent(),locale==='zh'?'第 100 局':'Round 100');
    assert.notEqual(await curve.getAttribute('d'),defaultPath);
    await check();
    await widget.screenshot({path:`${out}/ledger-${locale}-${width}-guest.png`});
    await widget.locator('button[data-view="house"]').focus(); await page.keyboard.press('Space');
    assert.equal(await curve.getAttribute('d'),defaultPath);
    assert.equal(await amount.getAttribute('data-value'),'46900');
    await widget.locator('[data-action="night"]').click();
    assert.notEqual(await curve.getAttribute('d'),defaultPath);
    await check();
    const start=Date.now();
    await widget.locator('[data-action="many"]').click();
    assert.equal(await widget.getAttribute('data-mode'),'many');
    const thousandPath=await curve.getAttribute('d');
    assert.equal((thousandPath.match(/L/g)||[]).length,1000);
    assert.equal(await widget.locator('svg text').last().textContent(),locale==='zh'?'第 1,000 晚':'Night 1,000');
    assert.ok(Number(await amount.getAttribute('data-value'))>50_000_000);
    await check();
    await widget.screenshot({path:`${out}/ledger-${locale}-${width}-many.png`});
    await guest.click(); await check();
    assert.equal((await curve.getAttribute('d')).match(/L/g).length,1000);
    await widget.locator('button[data-view="house"]').click();
    assert.equal(await curve.getAttribute('d'),thousandPath);
    await widget.locator('[data-action="many"]').click();
    assert.notEqual(await curve.getAttribute('d'),thousandPath);
    await widget.locator('[data-action="night"]').click();
    assert.equal(await widget.getAttribute('data-mode'),'night');
    assert.equal((await curve.getAttribute('d')).match(/L/g).length,100);
    await check();
    // Deterministic fixture survives reload, with no SSR/client mismatch.
    await page.reload({waitUntil:'networkidle'}); await widget.scrollIntoViewIfNeeded();
    await page.waitForFunction(()=>!document.querySelector('[data-testid="house-ledger"]').closest('astro-island').hasAttribute('ssr'));
    assert.equal(await curve.getAttribute('d'),defaultPath);
    const other=locale==='zh'?'en':'zh';
    await page.locator(`.lang-switch a[href="/${other}/prologue/"]`).click();
    assert.equal(new URL(page.url()).pathname,`/${other}/prologue/`);
    assert.deepEqual(errors,[]);
    reports.push({locale,width,states:8,errors,keyboard:true,noOverflow:true,reproducible:true,batchAndChecksMs:Date.now()-start});
    await page.close();
  }
  await writeFile(`${out}/report.json`,JSON.stringify(reports,null,2)+'\n');
  console.log('W2: zh/en × 390/640px; both views, reruns, 1,000 nights, keyboard, hydration and language links passed.');
} finally {await browser.close();}
