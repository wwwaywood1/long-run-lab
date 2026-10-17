import { describe, expect, it } from 'vitest';
import { appendSportsRound, createSportsSlips, newSportsSession, revealSportsSlips, settleSportsRound, sportsSlipView, TEAMS, type SportsSession } from '../engine/sports';
import { mulberry32 } from '../engine/rng';
import { SPORTS_COPY, legLabel, sportsLegNote, sportsMeta, sportsResult, sportsSlipText, sportsTeam, sportsTileText } from './sports';
import { highlightCopy } from './copy';
import { money } from './site';
import source from '../../i18n/source/Sports.json';
import numbers from '../../data/numbers.json';
const copy = (id: number, locale: 'zh' | 'en') => source.strings.find(s => s.id === `Sports.${String(id).padStart(3, '0')}`)![locale];
const completed = () => {
  const slips = revealSportsSlips(createSportsSlips(1, 2, true, mulberry32(921)));
  return appendSportsRound(newSportsSession(), settleSportsRound(slips, 10));
};
describe('G9 完整英文模板与静态数字', () => {
  it('整句英文和 16 个虚构队名均从源译文读取', () => {
    for (const text of Object.values(SPORTS_COPY.en)) expect(text).not.toMatch(/[\u3400-\u9fff]/);
    TEAMS.forEach((team, i) => { expect(sportsTeam(team, 'en')).toBe(copy(62 + i, 'en')); expect(sportsTeam(team, 'zh')).toBe(team); });
  });
  it.each([1, 2, 4, 8])('%s 串关标签使用完整模板', legs => {
    expect(legLabel(legs, 'en')).toBe(legs === 1 ? 'Single' : `${legs} legs, 1 bet`);
    expect(legLabel(legs, 'zh')).toBe(legs === 1 ? '单关' : `${legs} 串 1`);
  });
  it('已下单单数及命中率格式没有多余数字或碎片', () => {
    const session = { ...newSportsSession(), bets: 1, wins: 1 } as SportsSession;
    expect(sportsMeta(session, 'en')).toBe('1 bet · 1 won · Hit rate 100.0%');
    expect(sportsMeta(newSportsSession(), 'en')).toBe('0 bets · 0 won · Hit rate —');
    expect(sportsMeta({ ...session, bets: 1000, wins: 333 }, 'zh')).toBe('已下 1,000 单 · 全中 333 单 · 命中率 33.3%');
  });
  it('未选完的 match 单复数，以及含本金返还使用 money', () => {
    const one = createSportsSlips(1, 1, false, mulberry32(922));
    expect(sportsSlipText(sportsSlipView(one[0], 10), 'en')).toBe('Picked 0 / 1 match');
    const many = createSportsSlips(1, 8, false, mulberry32(923));
    expect(sportsSlipText(sportsSlipView(many[0], 10), 'en')).toBe('Picked 0 / 8 matches');
    const ready = createSportsSlips(1, 1, true, mulberry32(924)), view = sportsSlipView(ready[0], 1000);
    expect(sportsSlipText(view, 'en')).toBe(`Total odds ${view.odds!.toFixed(2)} · Win pays ${money(view.payout!, 'en', false)}`);
  });
  it.each([true, false])('已揭晓 %s 的十单文案按整句输出，动词后金额无正负号', won => {
    const slips = revealSportsSlips(createSportsSlips(1, 1, true, mulberry32(925)));
    const m = slips[0].matches[0]; m.result = won ? m.pick as 0 | 2 : 1;
    const view = sportsSlipView(slips[0], 10), text = sportsTileText(view, 1, false, 'en');
    expect(text.top).toBe(`${won ? 1 : 0}/1 right · odds ${view.odds!.toFixed(1)}`);
    expect(text.label).toBe(`${won ? 'Won' : 'Lost'} ${money(view.delta!, 'en', false)}`);
    expect(text.label).not.toMatch(/\b(?:Won|Lost) [−+]/);
    expect(sportsTileText(view, 1, false, 'zh').label).toMatch(won ? /^全中 \+/ : /^输 −/);
  });
  it('比赛前与进行中不输出隐藏的命中数', () => {
    const view = sportsSlipView(createSportsSlips(10, 4, false, mulberry32(926))[0], 10);
    expect(sportsTileText(view, 4, true, 'en')).toEqual({ top: `4 legs, 1 bet · odds ${view.odds!.toFixed(1)}`, label: copy(90, 'en') });
    expect(sportsTileText(view, 4, false, 'en').label).toBe(copy(91, 'en'));
  });
  it.each(['zh', 'en'] as const)('%s 状态与单/多轮结果完整输出', locale => {
    const session = completed();
    expect(sportsResult(session, 1, 'pick', locale)).toBe(copy(95, locale));
    expect(sportsResult(session, 10, 'pick', locale)).toBe(copy(96, locale));
    expect(sportsResult(session, 1, 'playing', locale)).toBe(copy(90, locale));
    expect(sportsResult(session, 10, 'done', locale)).toBe(locale === 'en' ? `This round: 1 bet · ${session.last!.wins} won · ${money(session.last!.delta, locale)}` : `本轮 1 单，全中 ${session.last!.wins} 单 · ${money(session.last!.delta, locale)}`);
    expect(sportsResult(session, 1, 'done', locale)).not.toMatch(/undefined|\{\{/);
  });
  it.each(['zh', 'en'] as const)('%s 串关期望说明用完整模板和当地货币', locale => {
    const value = numbers.sports.presentation.value.return_per_100['8'];
    const result = sportsLegNote(8, value, locale);
    expect(result).toContain(money(value, locale, false));
    expect(result).toBe(locale === 'en' ? '8 legs must all win. For every $100 you bet, the long-run average return is $51.3.' : '8 场全中才赢。每押 100 元，长期平均拿回 51.3 元。');
  });
  it.each(['zh', 'en'] as const)('%s 高亮保留整句和标点，统计副本与研究数据相符', locale => {
    const text = copy(49, locale), phrase = locale === 'en' ? 'the most tempting' : '最诱人';
    expect(highlightCopy(text, phrase).replace(/<\/?mark>/g, '')).toBe(text);
    const percent = `${(numbers.sports.example_overround.value * 100).toFixed(1)}%`;
    expect(copy(37, locale)).toContain(percent);
    const r = numbers.sports.presentation_reference.value;
    const june = numbers.facts.china_lottery_jun_2026, year = numbers.facts.china_lottery_2025;
    expect(copy(54, locale)).toContain(locale === 'en' ? (june.sales_yuan / 1e9).toFixed(3) : (june.sales_yuan / 1e8).toFixed(2));
    expect(copy(54, locale)).toContain(`${(june.yoy * 100).toFixed(1)}%`);
    expect(copy(58, locale)).toContain(`${Math.round(numbers.facts.jingcai_payout.value * 100)}%`);
    expect(copy(8, locale)).toContain(locale === 'en' ? (year.welfare_fund_yuan / 1e9).toFixed(1) : Math.round(year.welfare_fund_yuan / 1e8).toLocaleString('en-US'));
    expect(copy(9, locale)).toContain(locale === 'en' ? String(Math.round(year.sales_yuan / 1e9)) : Math.round(year.sales_yuan / 1e8).toLocaleString('en-US'));
    expect(copy(9, locale)).toContain(`${Math.round(year.welfare_fund_yuan / year.sales_yuan * 100)}%`);
    expect(copy(50, locale)).toContain(`${(r.example_8_leg_hit_probability * 100).toFixed(1)}%`);
    expect(copy(40, locale)).toContain(money(92, locale, false));
  });
});
