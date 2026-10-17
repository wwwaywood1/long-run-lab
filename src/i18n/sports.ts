import { counted, formatCopy, makeCopy } from './copy';
import { money, type Locale } from './site';
import { sportsHitRate, TEAMS, type SportsSession, type sportsSlipView } from '../engine/sports';
import source from '../../i18n/source/Sports.json';

export const SPORTS_COPY = makeCopy({
  tables: '同时下', tablesLabel: '同时下几单', bet: '每单', betLabel: '每单多少', legs: '串关', legsLabel: '串几场',
  pnl: '你的盈亏', meta: '已下 {{slips}} 单 · 全中 {{wins}} 单 · 命中率 {{hitRate}}', lost: '输掉的钱 {{itemText}}',
  favorites: '押热门', won: '全中', lostSlip: '错了至少一场', fast: '快进 100 轮', reset: '重来',
  chart: '你的盈亏随轮数变化，虚线为数学期望', note: '实线是你，虚线是数学期望。自动和快进都押热门。换成 8 串 1 再试，看虚线变多陡。',
  home: '主胜', draw: '平', away: '客胜', single: '单关', playing: '比赛中…', notStarted: '待开赛',
  pick: '选好每场的结果，再点“开赛”', multiPick: '点“开赛”，每单自动押热门',
  truthOn: '真实概率：开', truthOff: '看真实概率', next: '下一轮', kickoff: '开赛', auto: '自动押', stop: '停下',
}, source);
const TEAM_COPY = makeCopy(Object.fromEntries(TEAMS.map(team => [team, team])), source);
export const sportsTeam = (team: string, locale: Locale) => TEAM_COPY[locale][team];
export const legLabel = (legs: number, locale: Locale) => legs === 1 ? SPORTS_COPY[locale].single : locale === 'en' ? `${legs} legs, 1 bet` : `${legs} 串 1`;
export function sportsMeta(session: SportsSession, locale: Locale): string {
  const rate = sportsHitRate(session), hitRate = rate === null ? '—' : new Intl.NumberFormat('en-US', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(rate);
  return formatCopy(SPORTS_COPY[locale].meta, { slips: session.bets, wins: session.wins, hitRate }, locale);
}
export function sportsLegNote(legs: number, returnedPer100: number, locale: Locale): string {
  const returned = money(returnedPer100, locale, false), stake = money(100, locale, false);
  return locale === 'en' ? `${legs === 1 ? 'One match only' : `${legs} legs must all win`}. For every ${stake} you bet, the long-run average return is ${returned}.`
    : `${legs === 1 ? '只押一场' : `${legs} 场全中才赢`}。每押 ${stake}，长期平均拿回 ${returned}。`;
}
type SlipView = ReturnType<typeof sportsSlipView>;
export function sportsSlipText(view: SlipView | undefined, locale: Locale): string {
  if (!view) return '';
  if (!view.ready) return locale === 'en' ? `Picked ${view.picked} / ${counted(view.total, 'match', 'matches')}` : `已选 ${view.picked} / ${view.total} 场`;
  return locale === 'en' ? `Total odds ${view.odds!.toFixed(2)} · Win pays ${money(view.payout!, locale, false)}`
    : `总赔率 ${view.odds!.toFixed(2)} · 中了得 ${money(view.payout!, locale, false)}`;
}
export function sportsTileText(view: SlipView, legs: number, playing: boolean, locale: Locale) {
  const t = SPORTS_COPY[locale];
  const top = view.settled ? locale === 'en' ? `${view.right}/${view.total} right · odds ${view.odds!.toFixed(1)}` : `中 ${view.right}/${view.total} · 赔率 ${view.odds!.toFixed(1)}`
    : `${legLabel(legs, locale)}${locale === 'en' ? ' · odds ' : ' · 赔率 '}${view.odds!.toFixed(1)}`;
  // G-fix: verb-adjacent English amounts are unsigned, including these older source notes.
  const label = !view.settled ? playing ? t.playing : t.notStarted : locale === 'en' ? `${view.hit ? 'Won' : 'Lost'} ${money(view.delta!, locale, false)}`
    : `${view.hit ? '全中 ' : '输 '}${money(view.delta!, locale)}`;
  return { top, label };
}
export function sportsResult(session: SportsSession, tables: number, phase: 'pick' | 'playing' | 'done', locale: Locale): string {
  const t = SPORTS_COPY[locale];
  if (phase === 'pick') return tables === 1 ? t.pick : t.multiPick;
  if (phase === 'playing') return t.playing;
  const round = session.last!;
  if (tables === 1) return locale === 'en' ? `${round.wins ? `Won! Odds ${round.lastOdds.toFixed(2)} · ` : 'Not won · '}${money(round.delta, locale)}`
    : `${round.wins ? `全中！赔率 ${round.lastOdds.toFixed(2)} · ` : '没全中 · '}${money(round.delta, locale)}`;
  return locale === 'en' ? `This round: ${counted(round.bets, 'bet')} · ${round.wins} won · ${money(round.delta, locale)}`
    : `本轮 ${round.bets} 单，全中 ${round.wins} 单 · ${money(round.delta, locale)}`;
}
