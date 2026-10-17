import { describe, expect, it } from 'vitest';
import { drawGacha, FIVE_STAR_PITY, gachaPlayerView, newPlayer, PRICE_PER_PULL, simulateGachaGroup } from '../engine/gacha';
import { GACHA_COPY, gachaBanner, gachaMeta, groupRange, groupResult, pityText } from './gacha';
import { highlightCopy, formatCopy } from './copy';
import { money } from './site';
import { lossToItems } from '../engine/items';
import source from '../../i18n/source/Gacha.json';
import numbers from '../../data/numbers.json';

const copy = (id: number, locale: 'zh' | 'en') => source.strings.find(s => s.id === `Gacha.${String(id).padStart(3, '0')}`)![locale];
describe('G8 整句、金额和静态数字', () => {
  it('组件整句英文全部有译文', () => {
    for (const [key, value] of Object.entries(GACHA_COPY.en)) {
      expect(value, key).not.toMatch(/[\u3400-\u9fff]/);
      expect(value, key).toBe(source.strings.find(s => s.zh === GACHA_COPY.zh[key as keyof typeof GACHA_COPY.zh])?.en ?? 'Reset');
    }
  });
  it('整句统计行使用四种正确单数', () => {
    const text = gachaMeta({ ...newPlayer(), pulls: 1, featured: 1, off: 1, fours: 1 }, 'en');
    expect(text).toBe('1 pull · 1 limited card · 1 lost 50/50 · 1 4-star');
  });
  it('复数统计行与整句译文一致，数字使用千位分隔', () => {
    const player = { ...newPlayer(), pulls: 1234, featured: 2, off: 3, fours: 4 };
    expect(gachaMeta(player, 'en')).toBe(formatCopy(copy(9, 'en'), { pulls: 1234, feat: 2, off: 3, fours: 4 }, 'en'));
    expect(gachaMeta(player, 'zh')).toBe('共 1,234 抽 · 限定 2 张 · 歪了 3 次 · 四星 4 张');
  });
  it('保底数值和整句不拼中英碎片', () => {
    const player = { ...newPlayer(), since5: 76 };
    expect(pityText(player, 'en')).toBe('Banked 76 / 90');
    expect(pityText(player, 'zh')).toBe('已垫 76 / 90');
    expect(FIVE_STAR_PITY).toBe(90);
  });
  it.each(['zh', 'en'] as const)('%s 一抽得到限定时的 until 横幅无复数错误或美元', locale => {
    const run = drawGacha(newPlayer(), 'until', () => 0), banner = gachaBanner(run, run.player, locale);
    expect(banner.title).toBe(locale === 'en' ? 'It took 1 pull to get the limited card' : '抽了 1 抽才出限定');
    expect(banner.sub).toBe(locale === 'en' ? 'This one cost 16 yuan' : '这一张花了 16 元');
    expect(banner.sub).not.toMatch(/\$|−|\+/);
  });
  it.each(['zh', 'en'] as const)('%s 多抽直到限定时金额按此次购买，不误写总支出', locale => {
    const start = { ...newPlayer(), guaranteed: true, since5: 89, pulls: 100 };
    const run = drawGacha(start, 'until', () => .999999), banner = gachaBanner(run, run.player, locale);
    expect(run.cost).toBe(16); expect(gachaPlayerView(run.player).spent).toBe(1616);
    expect(banner.sub).toContain(locale === 'en' ? '16 yuan' : '16 元');
    expect(banner.sub).not.toContain('1,616');
  });
  it('限定、歪、没出金和初始横幅均使用整句', () => {
    const featured = drawGacha(newPlayer(), 1, () => 0), values = [0, .99];
    const off = drawGacha(newPlayer(), 1, () => values.shift()!);
    const none = drawGacha({ ...newPlayer(), since5: 88 }, 1, () => .99999);
    expect(gachaBanner(featured, featured.player, 'en')).toMatchObject({ title: copy(62, 'en'), sub: 'You have spent 16 yuan' });
    expect(gachaBanner(off, off.player, 'en')).toMatchObject({ title: copy(64, 'en'), sub: copy(65, 'en') });
    expect(gachaBanner(none, none.player, 'en')).toMatchObject({ title: copy(66, 'en'), sub: 'Just 1 more pull to pity' });
    expect(gachaBanner(null, newPlayer(), 'en')).toMatchObject({ title: copy(57, 'en'), sub: copy(58, 'en') });
  });
  it.each(['zh', 'en'] as const)('%s 多人范围与结果遵循完整模板并保留人民币', locale => {
    const group = simulateGachaGroup(10, () => .99999);
    expect(groupRange(group, locale)).toBe(locale === 'en' ? 'Cheapest 2,880 yuan · most expensive 2,880 yuan' : '最少 2,880 元 · 最多 2,880 元');
    expect(groupResult(group, locale)).toBe(locale === 'en' ? '10 players, 10 spent over 2,000 yuan' : '10 人里，10 人花了 2,000 元以上');
    expect(groupRange(null, locale)).toBe(copy(75, locale)); expect(groupResult(null, locale)).toBe('');
  });
  it('英文实物换算使用人民币价格与单数单位', () => {
    expect(lossToItems(16, 'en', 'CNY')).toBeNull();
    expect(lossToItems(32, 'en', 'CNY')).toMatchObject({ count: 1, item: { unit: 'bubble teas', price: 20 } });
    expect(lossToItems(160, 'en', 'CNY')).toMatchObject({ count: 3, item: { unit: 'movie tickets', price: 50 } });
  });
  it.each(['zh', 'en'] as const)('%s 高亮保留整句及句尾标点，返奖零也可定位', locale => {
    const text = copy(40, locale), phrase = locale === 'en' ? 'the money already in pushes you to put in more' : '已经投进去的钱，推着你投更多';
    const html = highlightCopy(text, phrase);
    expect(html).toContain(`<mark>${phrase}</mark>`); expect(html.replace(/<\/?mark>/g, '')).toBe(text);
    expect(copy(47, locale).split(String(numbers.gacha.presentation.value.cash_payout_rate))).toHaveLength(2);
  });
  it.each(['zh', 'en'] as const)('%s 原稿的成本、百分比与精确数据一致', locale => {
    const d = numbers.gacha, p = d.presentation.value, ex = p.pity_example;
    for (const [id, cost] of [[23, Math.round(d.mean_cost_featured_yuan.value)], [30, p.median_cost_featured_yuan], [32, p.p90_cost_featured_yuan], [34, p.max_cost_featured_yuan]]) {
      expect(copy(id, locale)).toContain(money(cost, locale, false, 'CNY'));
    }
    expect(copy(29, locale)).toContain(String(d.median_pulls_featured.value));
    expect(copy(31, locale)).toContain(String(d.p90_pulls_featured.value));
    expect(copy(33, locale)).toContain(String(d.max_pulls_featured.value));
    expect(copy(37, locale)).toContain(String(ex.banked)); expect(copy(38, locale)).toContain(String(ex.remaining));
    expect(copy(39, locale)).toContain(money(ex.spent_yuan, locale, false, 'CNY'));
    expect(copy(39, locale)).toContain(money(ex.remaining_cost_yuan, locale, false, 'CNY'));
    expect(copy(26, locale)).toContain(`${Math.round(d.histogram_featured_20.value['61-80'] * 100)}%`);
    expect(copy(27, locale)).toContain(`${Math.round(d.histogram_featured_20.value['141-160'] * 100)}%`);
    expect(copy(11, locale)).toContain(money(PRICE_PER_PULL, locale, false, 'CNY'));
    expect(copy(12, locale)).toContain(money(PRICE_PER_PULL * 10, locale, false, 'CNY'));
    expect(Math.round(d.share_5star_after_pull_73.value * 100)).toBe(64);
  });
});
