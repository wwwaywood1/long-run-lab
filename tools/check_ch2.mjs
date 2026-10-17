/** W3: both languages at 390/640px, every duration, restart, population, keyboard and overflow.
 * PLAYWRIGHT_MODULE_PATH=/path/to/playwright node tools/check_ch2.mjs [baseURL]
 * BROWSER_EXECUTABLE_PATH may point to a locally installed Chrome.
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const base = (process.argv[2] || 'http://127.0.0.1:4321').replace(/\/$/,'');
const out = 'qa-output/screenshots';
await mkdir(out,{recursive:true});
const browser = await chromium.launch({headless:true, executablePath:process.env.BROWSER_EXECUTABLE_PATH || undefined});
const reports=[];
try {
 for(const width of [390,640]) for(const locale of ['zh','en']) {
  const page=await browser.newPage({viewport:{width,height:844},reducedMotion:'reduce'});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error' && !m.text().includes('net::') && !m.location().url.endsWith('/favicon.ico')) errors.push(m.text());});
  await page.goto(`${base}/${locale}/ch2/`,{waitUntil:'networkidle'});
  const widget=page.locator('.ch2-sim');
  await widget.scrollIntoViewIfNeeded();
  await page.waitForFunction(()=>!document.querySelector('.ch2-sim').closest('astro-island').hasAttribute('ssr'));
  const buttons=widget.locator('.ch2-seg button');
  assert.equal(await buttons.nth(2).getAttribute('aria-pressed'),'true');
  assert.match(await widget.locator('[data-endpoint]').textContent(),/−(?:\$)?66/);
  assert.equal(await widget.locator('[data-player]').count(),13);
  await page.screenshot({path:`${out}/ch2-${locale}-${width}-full.png`,fullPage:true});
  await widget.screenshot({path:`${out}/ch2-${locale}-${width}-default.png`});
  const reset=widget.locator('.ch2-actions button').nth(0),run=widget.locator('.ch2-actions button').nth(1);
  const timings=[];
  for(const [i,n] of [10,100,1000,10000].entries()) {
   await buttons.nth(i).focus();
   await page.keyboard.press('Enter');
   await page.waitForFunction(n=>document.querySelector('.ch2-seg button[aria-pressed=true]')?.textContent===String(n),n);
   const path=await widget.locator('[data-you]').getAttribute('d');
   await reset.click();
   await page.waitForFunction(old=>document.querySelector('[data-you]').getAttribute('d')!==old,path);
   const begin=Date.now();
   await run.click();
   await page.waitForFunction(()=>document.querySelector('.ch2-result').textContent.includes('10,000'));
   timings.push({rounds:n,ms:Date.now()-begin});
   assert.match(await widget.locator('[role=status]').innerText(),locale==='zh'?/精确概率/:/exact probability/);
   assert.match(await widget.locator('[role=status]').innerText(),locale==='zh'?/打平/:/broke even/);
   await run.click();
   if(locale==='en') assert.doesNotMatch(await page.locator('main').innerText(),/[\u3400-\u9fff]/);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  }
  await widget.screenshot({path:`${out}/ch2-${locale}-${width}-population.png`});
  await reset.click();
  assert.doesNotMatch(await widget.locator('[role=status]').innerText(),/10,000/);
  for(const button of await widget.locator('button').all()) {
   const box=await button.boundingBox(); assert.ok(box.height>=44 && box.width>=44);
  }
  const other=locale==='zh'?'en':'zh';
  assert.ok(await page.locator(`a[href="/${other}/ch2/"]`).count()>0);
  const options=page.locator('.ch-option');
  await options.nth(2).click();
  assert.match(await options.nth(2).getAttribute('class'),/is-answer/);
  assert.deepEqual(errors,[]);
  reports.push({locale,width,timings,errors});
  await page.close();
 }
 await writeFile('qa-output/ch2-results.json',JSON.stringify(reports,null,2)+'\n');
 console.log(JSON.stringify(reports,null,2));
} finally {await browser.close();}
