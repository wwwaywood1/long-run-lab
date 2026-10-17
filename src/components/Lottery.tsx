import { useEffect, useRef, useState } from 'preact/hooks';
import {
  appendLotteryRound, drawLotteryRound, fastLotteryYears, lotteryElapsed, newLotterySession,
  LOTTERY_BATCH_YEARS, LOTTERY_BET_COUNTS, PRIZES,
  type CheckedTicket, type LotteryRound,
} from '../engine/lottery';
import { defaultRng } from '../engine/rng';
import { lossAmount } from '../engine/session';
import { counted, formatCopy, makeCopy } from '../i18n/copy';
import { money, type Locale } from '../i18n/site';
import source from '../../i18n/source/Lottery.json';
import SegmentedControl from './shared/SegmentedControl';
import PnlHeader, { pnlColor } from './shared/PnlHeader';
import PnlChart from './shared/PnlChart';
import LossConversion from './shared/LossConversion';
import HundredGrid from './shared/HundredGrid';
import './Lottery.css';

const COPY = {
  bets: '每期机选', betsLabel: '每期买几注', pnl: '你的盈亏',
  meta: '已买 {{draws}} 期（{{years}}）· 花了 {{spent}} 元 · 拿回 {{won}} 元', lost: '花掉的钱 {{itemText}}',
  myNumbers: '你的号码', buy: '买一期，开奖', year: '坚持买 1 年', decade: '坚持买 10 年',
  auto: '每期都买', stop: '停下', reset: '重来', start: '点“买一期，开奖”开始', drawing: '开奖中…',
  drawLabel: '本期开奖号码', emptyDrawLabel: '开奖号码', noPrize: '没中奖', noWin: '没中',
  first: '一等', second: '二等', third: '三等', fourth: '四等', fifth: '五等', sixth: '六等',
  prizes: '你中过的奖', variable: '浮动', chart: '你的盈亏随期数变化，虚线为数学期望',
  curveNote: '实线是你，虚线是数学期望。实线几乎是一条直线往下走，因为大奖几乎不会来。',
};
const T = makeCopy(COPY, source);
const BALL_MS = 380, PAUSE_MS = 900;
const tierKeys = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth'] as const;
interface Stage { phase: 'idle' | 'drawing' | 'done'; shown: number; round: LotteryRound | null }
const emptyStage = (): Stage => ({ phase: 'idle', shown: 0, round: null });
const pad = (n: number) => String(n).padStart(2, '0');
function Ball({ number, blue = false, matched = false, done = false, drawing = false }: { number?: number; blue?: boolean; matched?: boolean; done?: boolean; drawing?: boolean }) {
  return <span class={`lt-ball ${blue ? 'blue' : 'red'} ${number === undefined ? 'empty' : ''} ${drawing ? 'draw-ball' : ''} ${done ? matched ? 'matched' : 'missed' : ''}`}>{number === undefined ? '' : pad(number)}</span>;
}
export interface Props { locale: Locale; defaultBets?: 1 | 10 | 100 }
export default function Lottery({ locale, defaultBets = 1 }: Props) {
  const t = T[locale];
  const [bets, setBets] = useState<number>(defaultBets), [stage, setStage] = useState<Stage>(emptyStage);
  const [session, setSession] = useState(newLotterySession), [auto, setAuto] = useState(false);
  const sessionRef = useRef(session), busy = useRef(false), autoRef = useRef(false);
  const timer = useRef<number | null>(null), nextTimer = useRef<number | null>(null);
  const cancelStep = () => { if (timer.current !== null) { clearTimeout(timer.current); timer.current = null; } };
  const cancelNext = () => { if (nextTimer.current !== null) { clearTimeout(nextTimer.current); nextTimer.current = null; } };
  useEffect(() => () => { autoRef.current = false; cancelStep(); cancelNext(); }, []);
  const later = (fn: () => void, delay: number) => { cancelStep(); timer.current = window.setTimeout(() => { timer.current = null; fn(); }, delay); };
  const commit = (next: typeof session) => { sessionRef.current = next; setSession(next); };
  const scheduleNext = () => {
    cancelNext();
    if (autoRef.current) nextTimer.current = window.setTimeout(() => { nextTimer.current = null; if (autoRef.current) drawRef.current(); }, PAUSE_MS);
  };
  const draw = () => {
    if (busy.current) return;
    cancelNext(); busy.current = true;
    const round = drawLotteryRound(bets, defaultRng);
    setStage({ phase: 'drawing', shown: 0, round });
    const reveal = (shown: number) => {
      setStage({ phase: 'drawing', shown, round });
      if (shown < 7) later(() => reveal(shown + 1), BALL_MS);
      else later(() => {
        commit(appendLotteryRound(sessionRef.current, round)); busy.current = false;
        setStage({ phase: 'done', shown: 7, round }); scheduleNext();
      }, BALL_MS);
    };
    later(() => reveal(1), 200);
  };
  const drawRef = useRef(draw); drawRef.current = draw;
  const toggleAuto = () => {
    const value = !autoRef.current; autoRef.current = value; setAuto(value); cancelNext();
    if (value && !busy.current) drawRef.current();
  };
  const fast = (years: number) => {
    if (busy.current) return;
    cancelNext(); const next = fastLotteryYears(sessionRef.current, bets, years, defaultRng);
    commit(next); setStage({ phase: 'done', shown: 7, round: next.last }); scheduleNext();
  };
  const reset = () => {
    autoRef.current = false; busy.current = false; cancelStep(); cancelNext(); setAuto(false);
    commit(newLotterySession()); setStage(emptyStage());
  };
  const changeBets = (value: number) => { if (!busy.current) { setBets(value); setStage(emptyStage()); } };
  const done = stage.phase === 'done', drawing = stage.phase === 'drawing', round = stage.round;
  const currencyNumber = (amount: number) => money(amount, locale, false, 'CNY').split(' ')[0];
  const elapsed = lotteryElapsed(session.rounds);
  const years = elapsed.amount.toFixed(1);
  const elapsedText = locale === 'en'
    ? elapsed.unit === 'weeks' ? `About ${counted(elapsed.amount, 'week')}` : `About ${years} ${Number(years) === 1 ? 'year' : 'years'}`
    : elapsed.unit === 'weeks' ? `约 ${elapsed.amount} 周` : `约 ${years} 年`;
  const meta = formatCopy(t.meta, { draws: session.rounds, years: elapsedText, spent: currencyNumber(session.spent), won: currencyNumber(session.won) }, locale);
  const prizeText = (ticket: CheckedTicket) => ticket.tier ? locale === 'en'
    ? `${t[tierKeys[ticket.tier - 1]]} prize ${money(ticket.prize, locale, false, 'CNY')}`
    : `${t[tierKeys[ticket.tier - 1]]}奖 ${money(ticket.prize, locale, false, 'CNY')}` : t.noPrize;
  const compactPrize = (prize: number) => locale === 'en'
    ? prize >= 1_000_000 ? `${Math.round(prize / 1_000_000)}M` : currencyNumber(prize)
    : prize >= 10_000 ? `${Math.round(prize / 10_000)}万` : currencyNumber(prize);
  const ticketBalls = (ticket?: CheckedTicket) => <div class="lt-ticket-balls" role="img" aria-label={ticket ? `${ticket.reds.map(pad).join(' · ')} / ${pad(ticket.blue)}` : t.myNumbers}>
    {Array.from({ length: 7 }, (_, i) => <Ball key={i} number={ticket ? i === 6 ? ticket.blue : ticket.reds[i] : undefined} blue={i === 6} matched={ticket ? i === 6 ? ticket.blueHit : ticket.redMatches[i] : false} done={done} />)}
  </div>;
  let result = t.start;
  if (drawing) result = t.drawing;
  else if (done && round) {
    const one = round.tickets[0];
    result = bets === 1 ? locale === 'en'
      ? `Red balls matched: ${one.redHits}, blue ball ${one.blueHit ? 'matched' : 'missed'} · ${prizeText(one)}`
      : `红球中 ${one.redHits} 个，蓝球${one.blueHit ? '中' : '没中'} · ${prizeText(one)}`
      : locale === 'en' ? `This draw: ${counted(round.bets, 'bet')}, ${round.hits} won a prize · spent ${money(round.cost, locale, false, 'CNY')}, won back ${money(round.won, locale, false, 'CNY')}`
        : `本期 ${round.bets} 注，中奖 ${round.hits} 注 · 花 ${money(round.cost, locale, false, 'CNY')}，中回 ${money(round.won, locale, false, 'CNY')}`;
  }
  const drawLabel = round ? t.drawLabel : t.emptyDrawLabel;
  const visibleNumbers = round?.draw ? [...round.draw.reds, round.draw.blue].slice(0, stage.shown).map(pad) : [];
  return <div class="lt" data-lottery>
    <div class="lt-row lt-controls"><strong>{t.bets}</strong><SegmentedControl label={t.betsLabel} values={LOTTERY_BET_COUNTS} value={bets} format={n => locale === 'en' ? counted(n, 'bet') : `${n} 注`} onChange={changeBets} disabled={drawing} /></div>
    <PnlHeader pnl={session.pnl} locale={locale} currency="CNY" label={t.pnl} meta={meta}><LossConversion loss={lossAmount(session.pnl)} locale={locale} currency="CNY" label={t.lost} /></PnlHeader>
    <div class="lt-table" aria-busy={drawing}>
      <div class="lt-numbers"><span>{drawLabel}</span><div class="lt-draw-balls" role="img" aria-label={`${drawLabel}: ${visibleNumbers.join(' · ')}`} aria-live="polite">
        {Array.from({ length: 7 }, (_, i) => <Ball key={i} number={round?.draw && i < stage.shown ? i === 6 ? round.draw.blue : round.draw.reds[i] : undefined} blue={i === 6} drawing />)}
      </div></div>
      <div class="lt-divider"></div>
      {bets === 1 ? <div class="lt-numbers"><span>{t.myNumbers}</span>{ticketBalls(round?.tickets[0])}</div>
        : bets === 10 ? <div class="lt-ten">{round?.tickets.map((ticket, i) => <div class="lt-ticket-row" key={i}>{ticketBalls(ticket)}<strong class={ticket.tier && done ? 'won' : ''}>{done ? ticket.tier ? prizeText(ticket) : locale === 'en' ? t.noPrize : t.noWin : ''}</strong></div>)}</div>
          : <HundredGrid items={round?.tickets ?? []} label={t.myNumbers} renderCell={ticket => <div class={`lt-cell ${ticket.prize >= 10_000 ? 'compact' : ''} ${done ? ticket.tier ? 'won' : 'missed' : ''}`} aria-label={done ? prizeText(ticket) : t.drawing}><span>{done && ticket.tier ? compactPrize(ticket.prize) : ''}</span></div>} />}
      <div class="lt-result" role="status" style={{ color: done && round ? pnlColor(round.delta) : 'var(--muted)' }}>{result}</div>
    </div>
    <div class="lt-actions"><button type="button" class="btn btn-primary" disabled={drawing} onClick={draw}>{t.buy}</button><button type="button" class="btn btn-outline" aria-pressed={auto} onClick={toggleAuto}>{auto ? t.stop : t.auto}</button>{LOTTERY_BATCH_YEARS.map(years => <button type="button" key={years} class="btn btn-soft" disabled={drawing} onClick={() => fast(years)}>{years === 1 ? t.year : t.decade}</button>)}</div>
    <button type="button" class="btn btn-ghost lt-reset" onClick={reset}>{t.reset}</button>
    <div class="lt-prizes"><strong>{t.prizes}</strong><div class="lt-tier-grid">{PRIZES.slice(1).map((prize, i) => {
      const tier = i + 1, count = session.tiers[tier];
      return <div key={tier} class={`lt-tier ${count ? 'won' : ''}`}><span>{t[tierKeys[tier - 1]]}</span><strong>{count.toLocaleString('en-US')}</strong><small>{tier <= 2 ? t.variable : money(prize, locale, false, 'CNY')}</small></div>;
    })}</div></div>
    <PnlChart history={session.history} pnl={session.pnl} label={t.chart} note={t.curveNote} />
  </div>;
}
