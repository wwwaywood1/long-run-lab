import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const sources = {};
for (const name of ['common', 'Baccarat', 'SicBo', 'Slots', 'Crash', 'Blackjack', 'Lottery', 'Scratch', 'Gacha', 'Sports']) {
  sources[name] = JSON.parse(await readFile(new URL(`../i18n/source/${name}.json`, import.meta.url))).strings;
}
export const count = (n, word) => `${n.toLocaleString('en-US')} ${word}${n === 1 ? '' : 's'}`;
export function translator(locale, name) {
  return zh => {
    if (locale !== 'en') return zh;
    const unit = /^(\d+) (桌|台|局|注|张)$/.exec(zh);
    if (unit) return count(Number(unit[1]), { 桌: 'table', 台: 'machine', 局: 'round', 注: 'bet', 张: 'ticket' }[unit[2]]);
    return [...(sources[name] || []), ...sources.common].find(e => e.zh === zh)?.en || zh;
  };
}
/** Check visible text and accessible names in every exercised English state. */
export async function assertEnglish(page, locale) {
  if (locale !== 'en') return;
  const texts = await page.evaluate(() => {
    const copy = document.body.cloneNode(true);
    copy.querySelectorAll('script, style, .lang-switch').forEach(el => el.remove());
    // Keep adjacent elements apart: "Lost $100" + "0/4 right" is not "$1000".
    const walker = document.createTreeWalker(copy, NodeFilter.SHOW_TEXT), parts = [];
    while (walker.nextNode()) parts.push(walker.currentNode.textContent);
    return [parts.join(' '), ...[...copy.querySelectorAll('[aria-label], [title]')].flatMap(el => [el.getAttribute('aria-label') || '', el.getAttribute('title') || ''])];
  });
  for (const text of texts) {
    assert.doesNotMatch(text, /[\u3400-\u9fff\u3000-\u303f\uff01-\uff5e]/, `Chinese in English UI: ${text.slice(0, 160)}`);
    assert.doesNotMatch(text, /\b(?:you win|you lose|you won|net win)\s*[+−-]\$/i);
    assert.doesNotMatch(text, /(?<![\d,.])1 (?:tables|rounds|machines|bets|pulls|spins|celebrations|hands|draws|weeks|years|tickets|players|cards|4-stars|50\/50s)\b/);
    assert.doesNotMatch(text, /\$1000\b/);
  }
}
