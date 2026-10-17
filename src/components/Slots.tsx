import { useEffect, useRef, useState } from 'preact/hooks';
import { appendSlotsRound, newSlotsSession, pull, pullRound, slotsLossRates, REELS, STOPS, SLOTS_FAST_ROUNDS, type SettledPull } from '../engine/slots';
import { lossAmount } from '../engine/session';
import { defaultRng } from '../engine/rng';
import { money, type Locale } from '../i18n/site';
import { counted, formatCopy, makeCopy } from '../i18n/copy';
import source from '../../i18n/source/Slots.json';
import SegmentedControl from './shared/SegmentedControl';
import PnlHeader, { pnlColor } from './shared/PnlHeader';
import PnlChart from './shared/PnlChart';
import LossConversion from './shared/LossConversion';
import HundredGrid from './shared/HundredGrid';
import './Slots.css';

const COPY = {
  tables: '同时开', tableUnit: ' 台', tablesLabel: '同时开几台', bet: '每次投', betLabel: '每次投多少',
  pnl: '你的盈亏', lost: '输掉的钱 {{itemText}}', meta: '已拉 {{spins}} 次 · 响铃 {{rings}} 次 · 其中 {{fakes}} 次其实在亏',
  spin: '拉一下', auto: '自动拉', stop: '停下', fast: '快进 100 次', reset: '重来',
  spinning: '转动中…', start: '点“拉一下”开始', try: '拉一下试试', win: '真赢', ldw: '响铃，但吐得比投得少', miss: '没中',
  won: '赢了 ', exclamation: '！', invested: '你投了 ', actuallyLost: '，其实亏了 ', net: '净赚 ',
  near: '差一点！', nearNote: '前两个都是 7，第三个没停在 7 上。数学上，这和没中一样。',
  tileWin: '赢 ', tileLdw: '“赢” ', current: '本次 ', ringMachines: ' 台在响铃，其中 ', fakeMachines: ' 台其实在亏 · 本轮 ',
  chart: '你的盈亏随次数变化，虚线为数学期望', curveNote: '实线是你，虚线是数学期望。',
  minute: '每分钟平均输', night: '玩一个通宵（8 小时）', rateNote: '按每台每小时约 600 次的假设和数学期望计算。老虎机的优势不是最高的，但它最快。',
};
const T = makeCopy(COPY, source);
const ROW = 64, CYCLES = 7, DURATIONS = [1000, 1350, 1700], MULTI_MS = 1100, TICK_MS = 80, PAUSE_MS = 700;
const initialPositions = () => [STOPS, STOPS + 7, STOPS + 12];
// Strip repetition and symbol glyphs describe animation geometry only.
const STRIPS = REELS.map(reel => Array.from({ length: CYCLES * STOPS }, (_, i) => reel[i % STOPS]));
const GLYPHS: Record<string, string> = { '7': '7', B: 'BAR', S: '★', D: '◆', C: '●', _: '' };
function Symbol({ symbol, small = false }: { symbol: string; small?: boolean }) {
  return <span class={`sl-symbol symbol-${symbol} ${small ? 'small' : ''}`}>{GLYPHS[symbol]}</span>;
}
interface Visual { symbols: readonly string[]; result: SettledPull | null }
const blankMachines = (n: number): Visual[] => Array.from({ length: n }, () => ({ symbols: ['_', '_', '_'], result: null }));
export interface Props { locale: Locale; defaultTables?: 1 | 10 | 100 }
export default function Slots({ locale, defaultTables = 1 }: Props) {
  const t = T[locale];
  const [tables, setTables] = useState<number>(defaultTables), [bet, setBet] = useState(10);
  const [machines, setMachines] = useState(() => blankMachines(defaultTables));
  const [positions, setPositions] = useState(initialPositions), [animate, setAnimate] = useState(false);
  const [session, setSession] = useState(newSlotsSession);
  const sessionRef = useRef(session);
  const [spinning, setSpinning] = useState(false), [auto, setAuto] = useState(false);
  const busy = useRef(false), autoRef = useRef(false);
  const timers = useRef(new Set<number>()), nextTimer = useRef<number | null>(null), tick = useRef<number | null>(null);
  const clearTick = () => { if (tick.current !== null) { clearInterval(tick.current); tick.current = null; } };
  useEffect(() => () => { autoRef.current = false; timers.current.forEach(clearTimeout); timers.current.clear(); clearTick(); }, []);
  const later = (fn: () => void, ms: number) => {
    const id = window.setTimeout(() => { timers.current.delete(id); fn(); }, ms); timers.current.add(id); return id;
  };
  const cancelNext = () => {
    if (nextTimer.current !== null) { clearTimeout(nextTimer.current); timers.current.delete(nextTimer.current); nextTimer.current = null; }
  };
  const commit = (next: typeof session) => { sessionRef.current = next; setSession(next); };
  const scheduleNext = () => {
    cancelNext();
    if (autoRef.current) nextTimer.current = later(() => { nextTimer.current = null; if (autoRef.current) spinRef.current(); }, PAUSE_MS);
  };
  const spin = () => {
    if (busy.current) return;
    busy.current = true; cancelNext(); setSpinning(true);
    const round = pullRound(tables, bet, defaultRng);
    setMachines(machines.map(machine => ({ ...machine, result: null })));
    if (tables === 1) {
      setAnimate(false); setPositions(positions.map(p => STOPS + p % STOPS));
      later(() => { setAnimate(true); setPositions(round.machines[0].stops.map((stop, i) => STOPS * (3 + i) + stop)); }, 40);
    } else tick.current = window.setInterval(() => setMachines(Array.from({ length: tables }, () => ({ symbols: pull(defaultRng).symbols, result: null }))), TICK_MS);
    later(() => {
      clearTick();
      setMachines(round.machines.map(result => ({ symbols: result.symbols, result })));
      commit(appendSlotsRound(sessionRef.current, round)); busy.current = false; setSpinning(false); scheduleNext();
    }, tables === 1 ? 40 + DURATIONS[2] + 80 : MULTI_MS);
  };
  const spinRef = useRef(spin); spinRef.current = spin;
  const toggleAuto = () => {
    const next = !autoRef.current; autoRef.current = next; setAuto(next); cancelNext();
    if (next && !busy.current) spinRef.current();
  };
  const fast = () => {
    if (busy.current) return;
    cancelNext(); let next = sessionRef.current;
    for (let i = 0; i < SLOTS_FAST_ROUNDS; i++) next = appendSlotsRound(next, pullRound(tables, bet, defaultRng));
    commit(next); setMachines(next.last!.machines.map(result => ({ symbols: result.symbols, result })));
    if (tables === 1) { setAnimate(false); setPositions(next.last!.machines[0].stops.map(stop => STOPS + stop)); }
    scheduleNext();
  };
  const reset = () => {
    timers.current.forEach(clearTimeout); timers.current.clear(); nextTimer.current = null; clearTick();
    autoRef.current = false; busy.current = false; setAuto(false); setSpinning(false); setAnimate(false); setPositions(initialPositions());
    setMachines(blankMachines(tables)); commit(newSlotsSession());
  };
  const changeTables = (n: number) => { if (!busy.current) { setTables(n); setMachines(blankMachines(n)); } };
  const rates = slotsLossRates(tables, bet);
  const last = session.last, one = machines[0].result;
  let bannerTitle = spinning ? t.spinning : t.try, bannerSub = '', bannerClass = 'idle';
  if (!spinning && one) {
    bannerClass = one.outcome;
    if (one.outcome === 'ldw') {
      bannerTitle = locale === 'en' ? `You won ${money(one.gross, locale, false)}!` : `${t.won}${money(one.gross, locale, false)}${t.exclamation}`;
      bannerSub = locale === 'en' ? `You put in ${money(last!.stake, locale, false)}, but you actually lost ${money(one.loss, locale, false)}` : `${t.invested}${money(last!.stake, locale, false)}${t.actuallyLost}${money(one.loss, locale, false)}`;
    } else if (one.outcome === 'win') {
      bannerTitle = locale === 'en' ? `You won ${money(one.gross, locale, false)}` : `${t.won}${money(one.gross, locale, false)}`;
      bannerSub = locale === 'en' ? `Net win ${money(one.net, locale, false)}` : `${t.net}${money(one.net, locale, false)}`;
    } else if (one.nearMiss) { bannerClass = 'near'; bannerTitle = t.near; bannerSub = t.nearNote; }
    else { bannerTitle = t.miss; bannerSub = money(one.net, locale); }
  }
  let resultText = t.start;
  if (spinning) resultText = tables === 1 ? '' : t.spinning;
  else if (last && one) resultText = tables === 1 ? `${t.current}${money(last.delta, locale)}`
    : locale === 'en' ? `${counted(last.rings, 'machine')} celebrating · ${last.fakes} of them actually losing · This round ${money(last.delta, locale)}` : `${last.rings}${t.ringMachines}${last.fakes}${t.fakeMachines}${money(last.delta, locale)}`;
  return <div class="sl" data-slots>
    <div class="sl-controls">
      <div class="sl-row"><strong>{locale === 'en' ? 'Machines' : t.tables}</strong><SegmentedControl label={t.tablesLabel} values={[1, 10, 100]} value={tables} format={n => locale === 'en' ? counted(n, 'machine') : `${n}${t.tableUnit}`} onChange={changeTables} disabled={spinning} /></div>
      <div class="sl-row"><strong>{t.bet}</strong><SegmentedControl label={t.betLabel} values={[1, 10, 100]} value={bet} format={n => locale === 'zh' ? String(n) : money(n, locale, false)} onChange={setBet} disabled={spinning} /></div>
    </div>
    <PnlHeader pnl={session.pnl} locale={locale} label={t.pnl} meta={formatCopy(t.meta, { spins: session.bets, rings: session.rings, fakes: session.fakes }, locale)}>
      <LossConversion loss={lossAmount(session.pnl)} locale={locale} label={t.lost} />
    </PnlHeader>
    <div class="sl-table" aria-busy={spinning}>
      {tables === 1 ? <>
        <div class="sl-reels" role="img" aria-label={spinning ? t.spinning : one ? one.symbols.map(s => GLYPHS[s] || '—').join(' · ') : t.try}>
          {STRIPS.map((strip, axis) => <div key={axis} class="sl-window" aria-hidden="true">
            <div class="sl-strip" style={{ transform: `translateY(${-(positions[axis] - 1) * ROW}px)`, transition: animate ? `transform ${DURATIONS[axis]}ms cubic-bezier(0.12, 0.6, 0.2, 1)` : 'none' }}>
              {strip.map((symbol, i) => <div class="sl-reel-row" key={i}><Symbol symbol={symbol} /></div>)}
            </div><div class="sl-shade top"></div><div class="sl-shade bottom"></div>
          </div>)}<div class="sl-payline" aria-hidden="true"></div>
        </div>
        <div class={`sl-banner ${bannerClass}`} role="status"><strong>{bannerTitle}</strong><span>{bannerSub}</span></div>
      </> : tables === 10 ? <div class="sl-ten">{machines.map((machine, i) => {
        const result = machine.result;
        return <div key={i} class={`sl-tile ${result?.outcome ?? 'pending'}`}>
          <div class="sl-symbols" role="img" aria-label={machine.symbols.map(s => GLYPHS[s] || '—').join(' · ')}>{machine.symbols.map((symbol, j) => <div key={j}><Symbol symbol={symbol} small /></div>)}</div>
          <span>{result ? result.outcome === 'miss' ? t.miss : `${result.outcome === 'ldw' ? t.tileLdw : t.tileWin}${money(result.gross, locale, false)}` : '…'}</span>
        </div>;
      })}</div> : <>
        <HundredGrid items={machines} label={t.tablesLabel} renderCell={machine => <div class={`sl-cell ${machine.result?.outcome ?? 'pending'}`} aria-label={machine.result ? t[machine.result.outcome] : t.spinning}>{machine.result ? machine.result.outcome === 'win' ? '+' : machine.result.outcome === 'ldw' ? '−♪' : '−' : ''}</div>} />
        <div class="sl-legend"><span class="win">+ {t.win}</span><span class="ldw">−♪ {t.ldw}</span><span class="miss">− {t.miss}</span></div>
      </>}
      <div class="sl-result" role="status" style={{ color: !spinning && one && last ? pnlColor(last.delta) : 'var(--muted)' }}>{resultText}</div>
    </div>
    <div class="sl-actions">
      <button type="button" class="btn btn-primary" disabled={spinning} onClick={spin}>{t.spin}</button>
      <button type="button" class="btn btn-outline" aria-pressed={auto} onClick={toggleAuto}>{auto ? t.stop : t.auto}</button>
      <button type="button" class="btn btn-soft" disabled={spinning} onClick={fast}>{t.fast}</button>
      <button type="button" class="btn btn-ghost" onClick={reset}>{t.reset}</button>
    </div>
    <PnlChart history={session.history} pnl={session.pnl} label={t.chart} note={t.curveNote} />
    <div class="sl-rate">
      <div class="sl-row"><span>{t.minute}</span><strong class="sl-minute">{money(rates.perMinute, locale, false)}</strong></div>
      <div class="sl-row"><span>{t.night}</span><strong class="sl-mono">{money(Math.round(rates.perNight), locale, false)}</strong></div>
      <p class="shared-note">{t.rateNote}</p>
    </div>
  </div>;
}


/** Static reveal renderer; Astro passes data, while the cell renderer remains Preact JSX. */
export function SlotsOutcomeGrid({ items, label }: { items: readonly string[]; label: string }) {
  return <HundredGrid items={items} label={label} renderCell={kind => <div class={`sl-reveal-cell ${kind}`} aria-hidden="true"></div>} />;
}
