import { useEffect, useRef, useState } from 'preact/hooks';
import {
  appendScratchRound, buyScratchTickets, fastScratch, newScratchSession, revealScratchTicket,
  scratchCell, scratchView, settleScratchTickets, SCRATCH_COUNTS, PRICE,
  type PlayableScratchTicket,
} from '../engine/scratch';
import { defaultRng } from '../engine/rng';
import { lossAmount } from '../engine/session';
import { counted, formatCopy, makeCopy } from '../i18n/copy';
import { money, type Locale } from '../i18n/site';
import { scratchMoney } from '../i18n/scratch';
import source from '../../i18n/source/Scratch.json';
import SegmentedControl from './shared/SegmentedControl';
import PnlHeader, { pnlColor } from './shared/PnlHeader';
import PnlChart from './shared/PnlChart';
import LossConversion from './shared/LossConversion';
import HundredGrid from './shared/HundredGrid';
import './Scratch.css';

const COPY = {
  count: '一次买', countLabel: '一次买几张', pnl: '你的盈亏', lost: '输掉的钱 {{itemText}}',
  meta: '已刮 {{cards}} 张 · “中奖” {{hits}} 张 · 其中只拿回本钱 {{evens}} 张',
  title: '好运来 · 示例票', face: '面值 10 元 · 最高 100 万', winning: '中奖号码', mine: '我的号码',
  scratch: '刮', revealWinning: '刮开中奖号码', revealMine: '刮开我的号码',
  try: '买一张试试', instructions: '点格子刮开，或一键刮开', noWin: '没中',
  evenTitle: '中奖 10 元！', evenNote: '刚好拿回本钱，等于没中', evenLabel: '“中奖” 10 元',
  realWin: '真赢', evenLegend: '“中奖” 10 元，只拿回本钱',
  reveal: '一键刮开', auto: '一直买', stop: '停下', fast: '快进 100 次', reset: '重来', busy: '刮开中…',
  chart: '你的盈亏随张数变化，虚线为数学期望', curveNote: '实线是你，虚线是数学期望。“快进”连续买 100 次。',
};
const T = makeCopy(COPY, source);
const MULTI_MS = 700, AUTO_REVEAL_MS = 500, PAUSE_MS = 800;
export interface Props { locale: Locale; defaultCount?: 1 | 10 | 100 }
export default function Scratch({ locale, defaultCount = 1 }: Props) {
  const t = T[locale];
  const [count, setCount] = useState<number>(defaultCount), [tickets, setTickets] = useState<PlayableScratchTicket[]>([]);
  const ticketsRef = useRef(tickets), [session, setSession] = useState(newScratchSession), sessionRef = useRef(session);
  const [busy, setBusy] = useState(false), busyRef = useRef(false), [auto, setAuto] = useState(false), autoRef = useRef(false);
  const timer = useRef<number | null>(null), nextTimer = useRef<number | null>(null);
  const cancelStep = () => { if (timer.current !== null) { clearTimeout(timer.current); timer.current = null; } };
  const cancelNext = () => { if (nextTimer.current !== null) { clearTimeout(nextTimer.current); nextTimer.current = null; } };
  useEffect(() => () => { autoRef.current = false; cancelStep(); cancelNext(); }, []);
  const showTickets = (value: PlayableScratchTicket[]) => { ticketsRef.current = value; setTickets(value); };
  const markBusy = (value: boolean) => { busyRef.current = value; setBusy(value); };
  const commit = (value: typeof session) => { sessionRef.current = value; setSession(value); };
  const pending = () => ticketsRef.current.length === 1 && !ticketsRef.current[0].settled;
  const later = (fn: () => void, delay: number) => { cancelStep(); timer.current = window.setTimeout(() => { timer.current = null; fn(); }, delay); };
  const scheduleNext = () => {
    cancelNext();
    if (autoRef.current) nextTimer.current = window.setTimeout(() => { nextTimer.current = null; if (autoRef.current) buyRef.current(); }, PAUSE_MS);
  };
  const finish = (value: PlayableScratchTicket[]) => {
    cancelStep(); showTickets(value); markBusy(false);
    commit(appendScratchRound(sessionRef.current, settleScratchTickets(value))); scheduleNext();
  };
  const revealAll = () => { if (pending()) finish([revealScratchTicket(ticketsRef.current[0])]); };
  const revealRef = useRef(revealAll); revealRef.current = revealAll;
  const buy = () => {
    if (busyRef.current || pending()) return;
    cancelNext(); const value = buyScratchTickets(count, defaultRng); showTickets(value);
    if (count === 1) { if (autoRef.current) later(() => revealRef.current(), AUTO_REVEAL_MS); }
    else { markBusy(true); later(() => finish(value.map(revealScratchTicket)), MULTI_MS); }
  };
  const buyRef = useRef(buy); buyRef.current = buy;
  const scratch = (index: number) => {
    if (!pending()) return;
    const current = ticketsRef.current[0], next = scratchCell(current, index);
    if (current === next) return;
    if (next.settled) finish([next]); else showTickets([next]);
  };
  const toggleAuto = () => {
    const value = !autoRef.current; autoRef.current = value; setAuto(value); cancelNext();
    if (!value || busyRef.current) return;
    if (pending()) later(() => revealRef.current(), 10); else buyRef.current();
  };
  const fast = () => {
    if (busyRef.current || pending()) return;
    cancelNext(); const next = fastScratch(sessionRef.current, count, defaultRng);
    commit(next); showTickets(next.last!.tickets); scheduleNext();
  };
  const reset = () => {
    autoRef.current = false; cancelStep(); cancelNext(); setAuto(false); markBusy(false);
    showTickets([]); commit(newScratchSession());
  };
  const changeCount = (value: number) => { if (!busyRef.current && !pending()) { setCount(value); showTickets([]); } };
  const views = tickets.map(scratchView), one = views[0], canReveal = pending(), locked = busy || canReveal;
  const buyLabel = locale === 'en' ? `Buy ${counted(count, 'ticket')}` : `买${count === 1 ? '一' : count}张`;
  let bannerTitle = t.try, bannerSub = t.instructions, bannerKind = 'idle';
  if (one) {
    bannerKind = one.outcome;
    if (!one.settled) { bannerTitle = locale === 'en' ? `Still ${one.remaining} to go` : `还有 ${one.remaining} 格`; bannerSub = ''; }
    else if (one.outcome === 'miss') { bannerTitle = t.noWin; bannerSub = money(one.net!, locale, true, 'CNY'); }
    else if (one.outcome === 'even') { bannerTitle = t.evenTitle; bannerSub = t.evenNote; }
    else {
      bannerTitle = locale === 'en' ? `You win ${money(one.amount!, locale, false, 'CNY')}` : `中奖 ${money(one.amount!, locale, false, 'CNY')}`;
      bannerSub = `${locale === 'en' ? 'Net ' : '净赚 '}${money(one.net!, locale, false, 'CNY')}`;
    }
  }
  const outcomeLabel = (view: typeof one) => view.outcome === 'pending' ? t.busy : view.outcome === 'miss' ? t.noWin : view.outcome === 'even' ? t.evenLabel
    : locale === 'en' ? `You win ${money(view.amount!, locale, false, 'CNY')}` : `中奖 ${money(view.amount!, locale, false, 'CNY')}`;
  const netLabel = (view: typeof one) => view.outcome === 'pending' ? t.busy : view.outcome === 'even' ? `±${scratchMoney(0, locale)}` : money(view.net!, locale, true, 'CNY');
  let resultText = '';
  if (count > 1) {
    if (busy) resultText = t.busy;
    else if (tickets.length && session.last) resultText = locale === 'en'
      ? `This buy: ${counted(count, 'ticket')}, ${session.last.hits} ${session.last.hits === 1 ? '“win”' : '“wins”'}, ${session.last.evens} only broke even · ${money(session.last.delta, locale, true, 'CNY')}`
      : `本次 ${count} 张：“中奖” ${session.last.hits} 张，其中 ${session.last.evens} 张只拿回本钱 · ${money(session.last.delta, locale, true, 'CNY')}`;
    else resultText = locale === 'en' ? `Press “${buyLabel}” to start` : `点“买${count}张”开始`;
  }
  return <div class="sc" data-scratch>
    <div class="sc-row sc-controls"><strong>{t.count}</strong><SegmentedControl label={t.countLabel} values={SCRATCH_COUNTS} value={count} format={n => locale === 'en' ? counted(n, 'ticket') : `${n} 张`} onChange={changeCount} disabled={locked} /></div>
    <PnlHeader pnl={session.pnl} locale={locale} currency="CNY" label={t.pnl} meta={formatCopy(t.meta, { cards: session.bets, hits: session.hits, evens: session.evens }, locale)}><LossConversion loss={lossAmount(session.pnl)} locale={locale} currency="CNY" label={t.lost} /></PnlHeader>
    {count === 1 ? <div class="sc-ticket">
      <div class="sc-ticket-head"><strong>{t.title}</strong><span>{t.face}</span></div>
      <div class="sc-number-group" role="group" aria-label={t.winning}><span>{t.winning}</span><div class="sc-winning">
        {[0, 1].map(index => {
          const number = one?.winning[index] ?? null, open = number !== null;
          const label = !open ? t.revealWinning : locale === 'en' ? `Winning number ${number}` : `中奖号码 ${number}`;
          return <button type="button" data-cell={index} key={index} aria-label={label} aria-pressed={open} disabled={!one || open} class={open ? 'open' : one ? 'covered' : 'empty'} onClick={() => scratch(index)}>{open ? number : one ? t.scratch : ''}</button>;
        })}
      </div></div>
      <div class="sc-number-group" role="group" aria-label={t.mine}><span>{t.mine}</span><div class="sc-mine">
        {Array.from({ length: 6 }, (_, index) => {
          const cell = one?.mine[index], open = cell?.number != null, badge = open ? scratchMoney(cell!.prize!, locale) : '';
          const label = !open ? t.revealMine : locale === 'en' ? `Your number ${cell!.number}, prize ${badge}` : `我的号码 ${cell!.number}，奖金 ${badge}`;
          return <button type="button" data-cell={index + 2} key={index} aria-label={label} aria-pressed={open} disabled={!one || open} class={`${open ? 'open' : one ? 'covered' : 'empty'} ${cell?.hit ? 'hit' : ''}`} onClick={() => scratch(index + 2)}><strong>{open ? cell!.number : one ? t.scratch : ''}</strong><span>{badge}</span></button>;
        })}
      </div></div>
      <div class={`sc-banner ${bannerKind}`} role="status"><strong>{bannerTitle}</strong><span>{bannerSub}</span></div>
    </div> : count === 10 ? <div class="sc-ten" aria-busy={busy}>{views.map((view, i) => <div key={i} class={`sc-tile ${view.outcome}`}><span>{netLabel(view)}</span><strong>{view.outcome === 'pending' ? '' : outcomeLabel(view)}</strong></div>)}</div>
      : <div class="sc-hundred" aria-busy={busy}><HundredGrid items={views} label={t.countLabel} renderCell={view => <div class={`sc-cell ${view.outcome}`} aria-label={view.outcome === 'pending' ? t.busy : `${outcomeLabel(view)} · ${netLabel(view)}`}>{view.outcome === 'pending' ? '' : view.outcome === 'win' ? '+' : view.outcome === 'even' ? '=' : '−'}</div>} /><div class="sc-legend"><span>+ {t.realWin}</span><span>= {t.evenLegend}</span><span>− {t.noWin}</span></div></div>}
    <div class="sc-result" role="status" style={{ color: !locked && tickets.length && session.last ? pnlColor(session.last.delta) : 'var(--muted)' }}>{resultText}</div>
    <div class="sc-actions"><button type="button" class="btn btn-primary" disabled={locked} onClick={buy}>{buyLabel}</button><button type="button" class="btn btn-outline" disabled={!canReveal} onClick={revealAll}>{t.reveal}</button><button type="button" class="btn btn-soft sc-auto" aria-pressed={auto} onClick={toggleAuto}>{auto ? t.stop : t.auto}</button><button type="button" class="btn btn-soft" disabled={locked} onClick={fast}>{t.fast}</button></div>
    <button type="button" class="btn btn-ghost sc-reset" onClick={reset}>{t.reset}</button>
    <PnlChart history={session.history} pnl={session.pnl} label={t.chart} note={t.curveNote} />
  </div>;
}

export function ScratchOutcomeGrid({ counts, label }: { counts: { win: number; even: number; miss: number }; label: string }) {
  const items = Object.entries(counts).flatMap(([kind, count]) => Array.from({ length: count }, () => kind));
  return <HundredGrid items={items} label={label} className="sc-outcome-grid" renderCell={kind => <div class={`sc-outcome-cell ${kind}`} aria-hidden="true"></div>} />;
}
