import { counted, formatCopy, makeCopy } from './copy';
import { money, type Locale } from './site';
import type { GachaGroup, GachaRun, Player } from '../engine/gacha';
import { FIVE_STAR_PITY, gachaPlayerView } from '../engine/gacha';
import source from '../../i18n/source/Gacha.json';

export const GACHA_COPY = makeCopy({
  players: '同时看', playersLabel: '几位玩家', me: '只看我', spent: '你已经花了',
  meta: '共 {{pulls}} 抽 · 限定 {{feat}} 张 · 歪了 {{off}} 次 · 四星 {{fours}} 张',
  pity: '距离保底', single: '单抽 · 16 元', ten: '十连 · 160 元', until: '一直抽到限定', reset: '重来',
  priceNote: '按 648 元约换 40 抽折算，每抽约 16 元。抽卡不返还现金。',
  average: '每人都抽到限定卡为止，平均花了', low: '1,000 元以内', middle: '1,000–2,000 元', high: '2,000 元以上',
  rerun: '换一批人再抽', clear: '清空', featured: '限定', off: '歪了', four: '四星', three: '三星',
  try: '抽一发试试', tenNote: '十连至少出一张四星及以上', gotFeatured: '出了限定！',
  gotOff: '金光！但歪了', offNote: '下一个五星必是限定。要继续吗？', none: '没出金',
  guaranteed: '大保底：下一个五星必是限定', fifty: '小保底：下一个五星有一半概率是限定',
  start: '点下面的按钮开始',
}, source);

// Whole-sentence templates follow the source notes; CNY overrides the older $ examples.
export function gachaMeta(player: Player, locale: Locale): string {
  if (locale === 'zh') return formatCopy(GACHA_COPY.zh.meta, { pulls: player.pulls, feat: player.featured, off: player.off, fours: player.fours }, locale);
  return `${counted(player.pulls, 'pull')} · ${counted(player.featured, 'limited card')} · ${counted(player.off, 'lost 50/50', 'lost 50/50s')} · ${counted(player.fours, '4-star')}`;
}
export function pityText(player: Player, locale: Locale): string {
  return locale === 'en' ? `Banked ${player.since5} / ${FIVE_STAR_PITY}` : `已垫 ${player.since5} / ${FIVE_STAR_PITY}`;
}
export function gachaBanner(run: GachaRun | null, player: Player, locale: Locale) {
  const t = GACHA_COPY[locale], cost = money(run?.cost ?? 0, locale, false, 'CNY');
  if (!run) return { title: t.try, sub: t.tenNote, kind: 'idle' };
  if (run.banner === 'until') return {
    title: locale === 'en' ? `It took ${counted(run.count, 'pull')} to get the limited card` : `抽了 ${run.count} 抽才出限定`,
    sub: locale === 'en' ? `This one cost ${cost}` : `这一张花了 ${cost}`, kind: 'featured',
  };
  if (run.banner === 'featured') return { title: t.gotFeatured,
    sub: locale === 'en' ? `You have spent ${money(gachaPlayerView(player).spent, locale, false, 'CNY')}` : `你已经一共花了 ${money(gachaPlayerView(player).spent, locale, false, 'CNY')}`, kind: 'featured' };
  if (run.banner === 'off') return { title: t.gotOff, sub: t.offNote, kind: 'off' };
  const remaining = gachaPlayerView(player).remaining;
  return { title: t.none, sub: locale === 'en' ? `Just ${counted(remaining, 'more pull', 'more pulls')} to pity` : `再垫 ${remaining} 抽就保底了`, kind: 'none' };
}
export function groupRange(group: GachaGroup | null, locale: Locale): string {
  if (!group) return GACHA_COPY[locale].start;
  const min = money(group.min, locale, false, 'CNY'), max = money(group.max, locale, false, 'CNY');
  return locale === 'en' ? `Cheapest ${min} · most expensive ${max}` : `最少 ${min} · 最多 ${max}`;
}
export function groupResult(group: GachaGroup | null, locale: Locale): string {
  if (!group) return '';
  return locale === 'en' ? `${counted(group.players.length, 'player')}, ${group.over2k} spent over 2,000 yuan`
    : `${group.players.length} 人里，${group.over2k} 人花了 2,000 元以上`;
}
