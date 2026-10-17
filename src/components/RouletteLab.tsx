import { useEffect, useRef, useState } from 'preact/hooks';
import { POCKETS, WHEEL_ORDER, pocketKind, spinRed, settleRed, redLossRates, type RouletteRound } from '../engine/roulette';
import { defaultRng } from '../engine/rng';
import { appendRound, newSession, lossAmount } from '../engine/session';
import SegmentedControl from './shared/SegmentedControl';
import PnlHeader from './shared/PnlHeader';
import PnlChart from './shared/PnlChart';
import LossConversion from './shared/LossConversion';
import HundredGrid from './shared/HundredGrid';
import { money, type Locale } from '../i18n/site';
import { counted } from '../i18n/copy';
import './RouletteLab.css';

const SPIN_MS = 1800;
const PAUSE_MS = 700;
const SLICE = 360 / POCKETS;

const T = {
  zh: {
    tables: '同时开', tableUnit: (n: number) => `${n} 桌`, bet: '每桌押', pnl: '你的盈亏',
    meta: (r: string, b: string, h: string) => `已转 ${r} 局 · 共 ${b} 注 · 庄家 ${h}`,
    lost: '输掉的钱 {{itemText}}', spin: '转一局', auto: '自动转', stop: '停下', fast: '快进 100 局', reset: '重来',
    spinning: '转动中…', start: '点“转一局”开始',
    one: (label: string, d: string, win: boolean) => `落在 ${label} · ${win ? '你赢' : '你输'} ${d}`,
    many: (w: number, l: number, d: string) => `本局：赢 ${w} 桌 · 输 ${l} 桌 · ${d}`,
    curve: '盈亏曲线', curveNote: '实线是你，虚线是数学期望。玩得越久，两条线贴得越紧。',
    perHour: '按每小时', spinsUnit: (n: number) => `${n} 局`, perMin: '每分钟平均输', hour: '每小时', night: '玩一个通宵（8 小时）',
    rateNote: '按局数假设和数学期望计算。', youLost: '你已经输掉了', convert: '输掉的钱，会换算成实物',
    idleWin: (d: string) => `现在赢了 ${d}。继续转，看曲线往哪走。`, idle: '还没输。多转几局看看。',
    total: (d: string, n: number, unit: string) => `共 ${d}，相当于 ${n} ${unit}`, chartLabel: '你的盈亏随局数变化，虚线为数学期望',
    tablesLabel: '同时开几桌', betLabel: '每桌押多少', speedLabel: '每小时局数',
  },
  en: {
    tables: 'Tables', tableUnit: (n: number) => `${n}`, bet: 'Bet per table', pnl: 'Your net',
    meta: (r: string, b: string, h: string) => `${counted(Number(r.replaceAll(',', '')), 'spin')} · ${counted(Number(b.replaceAll(',', '')), 'bet')} · house ${h}`,
    lost: 'Lost so far {{itemText}}', spin: 'Spin', auto: 'Auto', stop: 'Stop', fast: 'Skip 100 spins', reset: 'Reset',
    spinning: 'Spinning…', start: 'Press “Spin” to start',
    one: (label: string, d: string, win: boolean) => `Landed on ${label} · you ${win ? 'win' : 'lose'} ${d}`,
    many: (w: number, l: number, d: string) => `This spin: ${w} won · ${l} lost · ${d}`,
    curve: 'Your net over time', curveNote: 'Solid: your net. Dashed: the expected loss. The longer you play, the closer they get.',
    perHour: 'Spins per hour', spinsUnit: (n: number) => `${n}`, perMin: 'Average loss per minute', hour: 'Per hour', night: 'One all-nighter (8 hours)',
    rateNote: 'Based on the spin-rate assumption and the expected value.', youLost: 'You have lost', convert: 'What you lose turns into real things',
    idleWin: (d: string) => `You're up ${d} for now. Keep spinning and watch the line.`, idle: 'Nothing lost yet. Spin a few more.',
    total: (d: string, n: number, unit: string) => `${d} in total — about ${n} ${unit}`, chartLabel: 'Your net by spin; dashed line is the expected value',
    tablesLabel: 'Number of tables', betLabel: 'Bet per table', speedLabel: 'Spins per hour',
  },
} as const;

interface Wheel { rot: number; result: number; settled: boolean; win: boolean }

const makeWheels = (n: number): Wheel[] => Array.from({ length: n }, (_, i) => ({ rot: (i * 97) % 360, result: -1, settled: false, win: false }));

const WHEEL_BG = (() => {
  const stops = Array.from({ length: POCKETS }, (_, i) => {
    const k = pocketKind(i);
    const c = k === 'house' ? '#111214' : k === 'win' ? '#2B59C3' : '#D9DCE1';
    return `${c} ${(i * SLICE).toFixed(2)}deg ${((i + 1) * SLICE).toFixed(2)}deg`;
  });
  return `conic-gradient(${stops.join(', ')})`;
})();

export interface Props { locale: Locale; defaultTables?: 1 | 10 | 100 }

export default function RouletteLab({ locale, defaultTables = 10 }: Props) {
  const t = T[locale];
  const [tables, setTables] = useState<number>(defaultTables);
  const [bet, setBet] = useState(10);
  const [sph, setSph] = useState(60);
  const [wheels, setWheels] = useState<Wheel[]>(() => makeWheels(defaultTables));
  const [anim, setAnim] = useState(true);
  const [spinning, setSpinning] = useState(false);
  const [auto, setAuto] = useState(false);
  const [game, setGame] = useState(() => newSession<RouletteRound>());
  const stats = game, history = game.history;
  const gameRef = useRef(game);
  const busy = useRef(false);
  const timers = useRef(new Set<number>());
  const nextTimer = useRef<number | null>(null);
  const autoRef = useRef(false);
  useEffect(() => () => { autoRef.current = false; timers.current.forEach(clearTimeout); timers.current.clear(); }, []);
  const later = (fn: () => void, ms: number) => {
    const id = window.setTimeout(() => { timers.current.delete(id); fn(); }, ms);
    timers.current.add(id); return id;
  };
  const cancelNext = () => {
    if (nextTimer.current !== null) { clearTimeout(nextTimer.current); timers.current.delete(nextTimer.current); nextTimer.current = null; }
  };
  const commit = (next: typeof game) => { gameRef.current = next; setGame(next); };
  const scheduleNext = () => {
    cancelNext();
    if (autoRef.current) nextTimer.current = later(() => {
      nextTimer.current = null; if (autoRef.current) spinRef.current();
    }, PAUSE_MS);
  };
  const changeTables = (n: number) => {
    if (busy.current) return;
    setTables(n); setWheels(makeWheels(n)); setAnim(false);
  };
  const spin = () => {
    if (busy.current) return;
    cancelNext(); busy.current = true;
    const next = wheels.map(w => {
      const result = spinRed(defaultRng);
      const base = w.rot - (w.rot % 360);
      const target = (360 - (result.index + .5) * SLICE) % 360;
      const jitter = (Math.random() - .5) * SLICE * .6;
      return { rot: base + 360 * (3 + Math.floor(Math.random() * 2)) + target + jitter, result: result.index, settled: false, win: result.win };
    });
    const round = settleRed(next.map(w => w.result), bet);
    setAnim(true); setSpinning(true); setWheels(next);
    later(() => {
      setWheels(next.map(w => ({ ...w, settled: true })));
      commit(appendRound(gameRef.current, round));
      busy.current = false; setSpinning(false); scheduleNext();
    }, SPIN_MS + 60);
  };
  const spinRef = useRef(spin);
  spinRef.current = spin;
  const fast = () => {
    if (busy.current) return;
    cancelNext();
    let next = gameRef.current;
    for (let k = 0; k < 100; k++) next = appendRound(next, settleRed(wheels.map(() => spinRed(defaultRng).index), bet));
    const last = next.last!.indices;
    setAnim(false);
    setWheels(wheels.map((w, i) => ({ rot: w.rot - (w.rot % 360) + ((360 - (last[i] + .5) * SLICE) % 360), result: last[i], settled: true, win: pocketKind(last[i]) === 'win' })));
    commit(next); scheduleNext();
  };
  const toggleAuto = () => {
    const next = !autoRef.current;
    autoRef.current = next; setAuto(next); cancelNext();
    if (next && !busy.current) spinRef.current();
  };
  const reset = () => {
    timers.current.forEach(clearTimeout); timers.current.clear(); nextTimer.current = null;
    autoRef.current = false; busy.current = false;
    setAuto(false); setSpinning(false); setAnim(false);
    setWheels(makeWheels(tables)); commit(newSession<RouletteRound>());
  };

  const n = wheels.length;
  const size = n === 1 ? 220 : n === 10 ? 50 : 26;
  const lossColor = 'var(--loss)';
  const pnlColor = stats.pnl < 0 ? lossColor : stats.pnl > 0 ? 'var(--you)' : 'var(--ink)';

  const loss = lossAmount(stats.pnl);
  const rates = redLossRates(tables, bet, sph);
  let resultText: string = t.start;
  if (spinning) resultText = t.spinning;
  else if (stats.last && wheels[0].settled) resultText = n === 1 ? t.one(stats.last.label, money(stats.last.delta, locale, locale === 'zh'), stats.last.delta > 0) : t.many(stats.last.wins, stats.last.losses, money(stats.last.delta, locale));
  const seg = (label: string, list: number[], cur: number, fmt: (v: number) => string, on: (v: number) => void, disabled = spinning) =>
    <SegmentedControl label={label} values={list} value={cur} format={fmt} onChange={on} disabled={disabled} />;
  const renderWheel = (w: Wheel) => {
    const ring = w.settled ? (w.win ? 'var(--you)' : lossColor) : 'transparent';
    const label = w.settled ? (n === 1 ? WHEEL_ORDER[w.result] : w.win ? '+' : '−') : '';
    const inset = n === 1 ? 70 : 14;
    return <div class="rl-wheel" role="img" aria-label={w.settled ? t.one(WHEEL_ORDER[w.result], '', w.win) : t.start} style={{ width: `${size}px`, height: `${size}px`, boxShadow: `0 0 0 ${n === 100 ? 2 : 3}px ${ring}` }}>
      <div class="disc" style={{ background: WHEEL_BG, transform: `rotate(${w.rot.toFixed(2)}deg)`, transition: anim ? `transform ${SPIN_MS}ms cubic-bezier(0.12, 0.65, 0.18, 1)` : 'none' }} />
      {n !== 100 && <div class="hub" style={{ inset: `${inset}px`, fontSize: `${n === 1 ? 26 : 12}px`, color: w.settled ? ring : 'var(--ink)' }}>{label}</div>}
    </div>;
  };

  return (
    <div class="rl" data-roulette>
      <div style="display:flex;flex-direction:column;gap:14px">
        <div class="rl-row"><span class="rl-label">{t.tables}</span>{seg(t.tablesLabel, [1, 10, 100], tables, t.tableUnit, changeTables)}</div>
        <div class="rl-row"><span class="rl-label">{t.bet}</span>{seg(t.betLabel, [10, 100, 1000], bet, (v) => (locale === 'zh' ? String(v) : money(v, locale, false)), (v) => !spinning && setBet(v))}</div>
      </div>

      <PnlHeader pnl={stats.pnl} locale={locale} label={t.pnl} meta={t.meta(stats.rounds.toLocaleString('en-US'), stats.bets.toLocaleString('en-US'), money(-stats.pnl, locale))}>
        <LossConversion loss={loss} locale={locale} label={t.lost} />
      </PnlHeader>

      <div class="rl-table">
        {n === 1 && <div class="rl-pointer" aria-hidden="true"><svg width="18" height="14" viewBox="0 0 18 14"><path d="M9 14 L1 0 H17 Z" fill="#111214" /></svg></div>}
        {n === 100 ? <HundredGrid items={wheels} label={t.tablesLabel} renderCell={renderWheel} /> :
          <div class="rl-grid" style={{ gridTemplateColumns: n === 1 ? '1fr' : 'repeat(5, minmax(0, 1fr))', gap: '12px' }}>{wheels.map(renderWheel)}</div>}
        <div class="rl-result" role="status">{resultText}</div>
      </div>

      <div class="rl-actions">
        <button type="button" class="btn btn-primary" disabled={spinning} onClick={spin}>{t.spin}</button>
        <button type="button" class="btn btn-outline" aria-pressed={auto} onClick={toggleAuto}>{auto ? t.stop : t.auto}</button>
        <button type="button" class="btn btn-soft" disabled={spinning} onClick={fast}>{t.fast}</button>
        <button type="button" class="btn btn-ghost" onClick={reset}>{t.reset}</button>
      </div>

      <PnlChart history={history} pnl={stats.pnl} title={t.curve} label={t.chartLabel} note={t.curveNote} height={130} />

      <div class="rl-rate">
        <div class="rl-row"><span class="rl-label">{t.perHour}</span>{seg(t.speedLabel, [30, 60, 120], sph, t.spinsUnit, setSph, false)}</div>
        <div class="line"><span>{t.perMin}</span><span class="loss">{money(rates.perMinute, locale, false)}</span></div>
        <div class="line"><span>{t.hour}</span><span class="mono">{money(rates.perHour, locale, false)}</span></div>
        <div class="line"><span>{t.night}</span><span class="mono">{money(rates.perNight, locale, false)}</span></div>
        <p class="note">{t.rateNote}</p>
      </div>

      <LossConversion loss={loss} locale={locale} variant="panel" label={loss > 0 ? t.youLost : t.convert} emptyText={stats.pnl > 0 ? t.idleWin(money(stats.pnl, locale, locale === 'zh')) : t.idle} />
    </div>
  );
}
