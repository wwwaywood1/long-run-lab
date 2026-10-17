/**
 * 英文页里不该有中文：扫描构建结果 dist/en/ 下的 HTML，列出含中文的文字。
 * 先 npm run build，再 npm run check:en。只查服务端渲染出的初始状态；交互后才出现的文字由各游戏的浏览器检查覆盖。
 * 允许的例外：语言切换按钮“中”。
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve('dist/en');
const CJK = /[\u3400-\u9fff\u3000-\u303f\uff01-\uff5e]/; // 汉字、中文标点、全角符号（英文弯引号不算）
const ALLOWED = new Set(['中']);

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(p);
    else if (entry.name.endsWith('.html')) yield p;
  }
}

let total = 0;
for await (const file of walk(ROOT)) {
  const html = await readFile(file, 'utf8');
  const text = html
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, '\n')
    .replace(/&[a-z#0-9]+;/gi, ' ');
  const hits = [...new Set(text.split('\n').map(s => s.trim()).filter(s => s && CJK.test(s) && !ALLOWED.has(s)))];
  if (hits.length) {
    total += hits.length;
    console.log(`\n${path.relative(process.cwd(), file)}  (${hits.length})`);
    for (const h of hits.slice(0, 40)) console.log('  ' + h.slice(0, 120));
  }
}
console.log(total ? `\n${total} untranslated strings` : 'No Chinese on English pages.');
process.exitCode = total ? 1 : 0;
