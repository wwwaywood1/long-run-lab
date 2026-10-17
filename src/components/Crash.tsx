import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import {
  advanceFlight, appendCrashRound, canJump, crashLossRates, crashTargetTerms, fastFlight, flightSummary, floorX,
  jumpFlight, multiplierAt, newCrashSession, newFlight, settleFlight, startFlight, timeAtMultiplier,
  CRASH_DISPLAY_CAP, CRASH_FAST_ROUNDS, CRASH_PAUSE_MS, CRASH_TARGETS, CRASH_TICK_MS, type Flight,
} from '../engine/crash';
import { defaultRng } from '../engine/rng';
import { lossAmount } from '../engine/session';
import { money, type Locale } from '../i18n/site';
import { counted, formatCopy, makeCopy } from '../i18n/copy';
import source from '../../i18n/source/Crash.json';
import SegmentedControl from './shared/SegmentedControl';
import PnlHeader, { pnlColor } from './shared/PnlHeader';
import PnlChart from './shared/PnlChart';
import LossConversion from './shared/LossConversion';
import HundredGrid from './shared/HundredGrid';
import './Crash.css';

const COPY = {
  tables: '同时开', tableUnit: ' 局', tablesLabel: '同时开几局', bet: '每注', betLabel: '每注多少', target: '自动跳车点',
  probability: '每局成功跳车的概率 ', successWin: '，成功赢 ', failureLoss: '，失败输 ', fullStop: '。',
  pnl: '你的盈亏', lost: '输掉的钱 {{itemText}}', meta: '已飞 {{rounds}} 轮 · 共 {{bets}} 注 · 跳车成功 {{cashRate}}',
  flying: '飞行中', ended: '本轮结束', waiting: '等待起飞', bust: '爆了', cashedAt: '已在 ', jumped: ' 跳车',
  stillFlying: '还在飞', success: '跳车成功', bustPrefix: '爆 ', cashSuffix: ' 跳', laterBust: ' · 后来爆在 ',
  start: '点“起飞”开始', autoAt: '自动在 ', manualNote: ' 跳车，也可以手动跳', flyingCount: '还在飞 ', cashedCount: ' 局 · 已跳 ', bustCount: ' · 已爆 ',
  at: '在 ', bustLose: ' 爆了 · 你输 ', youWin: '你赢 ', later: ' · 它后来', flewPast: '飞过了 ', explodedAt: '爆在 ',
  roundCash: '本轮：跳车成功 ', roundBust: ' 局 · 爆了 ', roundEnd: ' 局 · ', autoLine: '自动跳车 ',
  jump: '现在跳车', launch: '起飞', auto: '自动玩', stop: '停下', fast: '快进 100 轮', reset: '重来',
  chart: '你的盈亏随轮数变化，虚线为数学期望', flightChart: '倍数随时间上涨的曲线',
  curveNote: '实线是你，虚线是数学期望。换个跳车点再试试，虚线的斜率不会变。',
  minute: '每分钟平均输', night: '玩一个通宵（8 小时）', rateNote: '按每局约 20 秒、每小时 180 局的假设和数学期望计算。',
};
const T = makeCopy(COPY, source);
// 爆点和倍数一律向下取到 0.01 显示：显示 2.00× 的局，2× 跳车一定成功
const xText = (m: number) => `${floorX(m).toFixed(2)}×`;
const percent = (p: number) => new Intl.NumberFormat('en-US', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(p);
export interface Props { locale: Locale; defaultTables?: 1 | 10 | 100 }
export default function Crash({ locale, defaultTables = 1 }: Props) {
  const t = T[locale];
  const [tables, setTables] = useState<number>(defaultTables), [bet, setBet] = useState(10), [target, setTarget] = useState<number>(2);
  const [flight, setFlight] = useState(() => newFlight(defaultTables));
  const flightRef = useRef(flight);
  const [session, setSession] = useState(newCrashSession);
  const sessionRef = useRef(session);
  const [auto, setAuto] = useState(false);
  const autoRef = useRef(false), tick = useRef<number | null>(null), nextTimer = useRef<number | null>(null);
  const clearTick = () => { if (tick.current !== null) { clearInterval(tick.current); tick.current = null; } };
  const cancelNext = () => { if (nextTimer.current !== null) { clearTimeout(nextTimer.current); nextTimer.current = null; } };
  useEffect(() => () => { autoRef.current = false; clearTick(); cancelNext(); }, []);
  const commitFlight = (next: Flight) => { flightRef.current = next; setFlight(next); };
  const commitSession = (next: typeof session) => { sessionRef.current = next; setSession(next); };
  const scheduleNext = () => {
    cancelNext();
    if (autoRef.current) nextTimer.current = window.setTimeout(() => {
      nextTimer.current = null; if (autoRef.current) launchRef.current();
    }, CRASH_PAUSE_MS);
  };
  const launch = () => {
    if (flightRef.current.running) return;
    cancelNext(); commitFlight(startFlight(tables, target, bet, defaultRng));
    tick.current = window.setInterval(() => {
      const next = advanceFlight(flightRef.current); commitFlight(next);
      if (!next.running) {
        clearTick(); commitSession(appendCrashRound(sessionRef.current, settleFlight(next))); scheduleNext();
      }
    }, CRASH_TICK_MS);
  };
  const launchRef = useRef(launch); launchRef.current = launch;
  const mainAction = () => {
    if (flightRef.current.running) { if (canJump(flightRef.current)) commitFlight(jumpFlight(flightRef.current)); }
    else launchRef.current();
  };
  const toggleAuto = () => {
    const next = !autoRef.current; autoRef.current = next; setAuto(next); cancelNext();
    if (next && !flightRef.current.running) launchRef.current();
  };
  const fast = () => {
    if (flightRef.current.running) return;
    cancelNext(); let next = sessionRef.current;
    for (let i = 0; i < CRASH_FAST_ROUNDS; i++) next = appendCrashRound(next, settleFlight(fastFlight(tables, target, bet, defaultRng)));
    commitSession(next); commitFlight(next.last!.flight); scheduleNext();
  };
  const reset = () => {
    autoRef.current = false; clearTick(); cancelNext(); setAuto(false);
    commitFlight(newFlight(tables, target, bet)); commitSession(newCrashSession());
  };
  const changeTables = (n: number) => { if (!flightRef.current.running) { setTables(n); commitFlight(newFlight(n, target, bet)); } };
  const changeTarget = (n: number) => { if (!flightRef.current.running) { setTarget(n); commitFlight({ ...flightRef.current, target: n }); } };
  const summary = flightSummary(flight), one = flight.games[0], running = flight.running;
  const terms = crashTargetTerms(target, bet), rates = crashLossRates(tables, bet);
  let multiplier = xText(flight.m), status = t.waiting, statusColor = 'var(--muted)', multiplierColor = 'var(--ink)';
  if (tables > 1) status = running ? t.flying : one.idle ? t.waiting : t.ended;
  else if (!one.idle) {
    if (running && !one.done) status = t.flying;
    else if (one.bust) { status = t.bust; statusColor = multiplierColor = 'var(--loss)'; multiplier = xText(one.crash); }
    else if (one.done) {
      status = locale === 'en' ? `Cashed out at ${xText(one.cash)}` : `${t.cashedAt}${xText(one.cash)}${t.jumped}`; statusColor = 'var(--you)';
      if (!running) multiplier = one.crash > CRASH_DISPLAY_CAP ? `>${CRASH_DISPLAY_CAP}×` : xText(one.crash);
    }
  }
  const plot = useMemo(() => {
    const xmax = Math.max(4, flight.t * 1.15), ymax = Math.max(2.2, flight.m * 1.15, target * 1.1);
    const px = (seconds: number) => (seconds / xmax * 292).toFixed(1);
    const py = (m: number) => (176 - (m - 1) / (ymax - 1) * 160).toFixed(1);
    const points = Array.from({ length: 49 }, (_, i) => { const seconds = flight.t * i / 48; return `${px(seconds)} ${py(multiplierAt(seconds))}`; });
    const cashT = one.cash ? timeAtMultiplier(one.cash) : 0;
    return { path: 'M' + points.join(' L'), headX: px(flight.t), headY: py(flight.m),
      cashX: px(cashT), cashY: py(one.cash || 1), cashShown: Boolean(one.cash && cashT <= flight.t + .001),
      targetY: py(target), labelY: (Number(py(target)) - 6).toFixed(1) };
  }, [flight, target]);
  let resultText = t.start;
  if (locale === 'en') {
    // Crash.044, .049, .051, .055: complete sentences, unsigned amounts after verbs.
    if (running) resultText = tables === 1 ? `Auto cash-out at ${xText(target)}, or cash out by hand`
      : `${summary.flying} still flying · ${summary.cashed} cashed out · ${summary.bust} busted`;
    else if (!one.idle && session.last) resultText = tables === 1
      ? one.bust ? `Busted at ${xText(one.crash)} · you lose ${money(session.last.delta, locale, false)}`
        : `You win ${money(session.last.delta, locale, false)} · it later ${one.crash > CRASH_DISPLAY_CAP ? `flew past ${CRASH_DISPLAY_CAP}×` : `crashed at ${xText(one.crash)}`}`
      : `This round: ${session.last.cashed} cashed out · ${session.last.bust} busted · ${money(session.last.delta, locale)}`;
  } else {
    if (running) resultText = tables === 1 ? `${t.autoAt}${xText(target)}${t.manualNote}`
      : `${t.flyingCount}${summary.flying}${t.cashedCount}${summary.cashed}${t.bustCount}${summary.bust}`;
    else if (!one.idle && session.last) {
      if (tables === 1) resultText = one.bust ? `${t.at}${xText(one.crash)}${t.bustLose}${money(session.last.delta, locale)}`
        : `${t.youWin}${money(session.last.delta, locale)}${t.later}${one.crash > CRASH_DISPLAY_CAP ? `${t.flewPast}${CRASH_DISPLAY_CAP}×` : `${t.explodedAt}${xText(one.crash)}`}`;
      else resultText = `${t.roundCash}${session.last.cashed}${t.roundBust}${session.last.bust}${t.roundEnd}${money(session.last.delta, locale)}`;
    }
  }
  return <div class="cr" data-crash>
    <div class="cr-controls">
      <div class="cr-row"><strong>{locale === 'en' ? 'Rounds' : t.tables}</strong><SegmentedControl label={t.tablesLabel} values={[1, 10, 100]} value={tables} format={n => locale === 'en' ? counted(n, 'round') : `${n}${t.tableUnit}`} onChange={changeTables} disabled={running} /></div>
      <div class="cr-row"><strong>{t.bet}</strong><SegmentedControl label={t.betLabel} values={[10, 100, 1000]} value={bet} format={n => locale === 'zh' ? String(n) : money(n, locale, false)} onChange={setBet} disabled={running} /></div>
      <div class="cr-target"><strong>{t.target}</strong><SegmentedControl label={t.target} values={CRASH_TARGETS} value={target} format={n => `${n}×`} onChange={changeTarget} disabled={running} />
        <p class="shared-note">{locale === 'en' ? `Chance of cashing out in a round: ${percent(terms.probability)}. Win ${money(terms.win, locale, false)} if you do, lose ${money(terms.loss, locale, false)} if it crashes.` : `${t.probability}${percent(terms.probability)}${t.successWin}${money(terms.win, locale, false)}${t.failureLoss}${money(terms.loss, locale, false)}${t.fullStop}`}</p>
      </div>
    </div>
    <PnlHeader pnl={session.pnl} locale={locale} label={t.pnl} meta={formatCopy(t.meta, { rounds: session.rounds, bets: session.bets, cashRate: session.cashRate === null ? '—' : percent(session.cashRate) }, locale)}>
      <LossConversion loss={lossAmount(session.pnl)} locale={locale} label={t.lost} />
    </PnlHeader>
    <div class="cr-table" aria-busy={running}>
      <div class="cr-head"><strong style={{ color: multiplierColor }}>{multiplier}</strong><span style={{ color: statusColor }} data-flight-status>{status}</span></div>
      {tables === 1 ? <svg class="cr-flight-chart" viewBox="0 0 302 180" role="img" aria-label={t.flightChart}>
        <line x1="0" y1="176" x2="302" y2="176" stroke="var(--rule)" />
        <line x1="0" y1={plot.targetY} x2="302" y2={plot.targetY} stroke="var(--you)" stroke-dasharray="4 4" stroke-opacity=".8" />
        <text x="2" y={plot.labelY} font-family="var(--font-mono)" font-size="11" fill="var(--you)" fill-opacity=".8">{t.autoLine}{target}×</text>
        <path d={plot.path} fill="none" stroke={one.bust ? 'var(--loss)' : 'var(--ink)'} stroke-width="3" stroke-linejoin="round" stroke-linecap="round" />
        <circle data-cash-marker cx={plot.cashX} cy={plot.cashY} r="6" fill="var(--you)" fill-opacity={plot.cashShown ? 1 : 0} />
        <circle cx={plot.headX} cy={plot.headY} r="7" fill={one.bust ? 'var(--loss)' : 'var(--ink)'} />
      </svg> : tables === 10 ? <div class="cr-ten">{flight.games.map((game, i) => <div key={i} class={`cr-tile ${game.idle ? 'idle' : !game.done ? 'flying' : game.bust ? 'bust' : 'cashed'}`}>
        <strong>{game.idle ? '—' : !game.done ? xText(flight.m) : game.bust ? `${t.bustPrefix}${xText(game.crash)}` : locale === 'en' ? `Cashed out at ${xText(game.cash)}` : `${xText(game.cash)}${t.cashSuffix}`}</strong>
        <span>{game.idle ? t.waiting : !game.done ? t.stillFlying : `${money(game.net, locale)}${!game.bust && !running ? `${t.laterBust}${game.crash > 999 ? '999+' : floorX(game.crash).toFixed(2)}×` : ''}`}</span>
      </div>)}</div> : <>
        <HundredGrid items={flight.games} label={t.tablesLabel} renderCell={game => <div class={`cr-cell ${game.idle ? 'idle' : !game.done ? 'flying' : game.bust ? 'bust' : 'cashed'}`} aria-label={game.idle ? t.waiting : !game.done ? t.stillFlying : game.bust ? t.bust : t.success}>{game.idle ? '' : !game.done ? '…' : game.bust ? '−' : '+'}</div>} />
        <div class="cr-legend"><span>… {t.stillFlying}</span><span>+ {t.success}</span><span>− {t.bust}</span></div>
      </>}
      <div class="cr-result" role="status" style={{ color: !running && !one.idle && session.last ? pnlColor(session.last.delta) : 'var(--muted)' }}>{resultText}</div>
    </div>
    <div class="cr-actions">
      <button type="button" class={`btn btn-primary ${running ? 'jump' : ''}`} onClick={mainAction} disabled={running && !canJump(flight)}>{running ? t.jump : t.launch}</button>
      <button type="button" class="btn btn-outline" aria-pressed={auto} onClick={toggleAuto}>{auto ? t.stop : t.auto}</button>
      <button type="button" class="btn btn-soft" disabled={running} onClick={fast}>{t.fast}</button>
      <button type="button" class="btn btn-ghost" onClick={reset}>{t.reset}</button>
    </div>
    <PnlChart history={session.history} pnl={session.pnl} label={t.chart} note={t.curveNote} />
    <div class="cr-rate"><div class="cr-row"><span>{t.minute}</span><strong class="cr-minute">{money(rates.perMinute, locale, false)}</strong></div><div class="cr-row"><span>{t.night}</span><strong class="cr-mono">{money(Math.round(rates.perNight), locale, false)}</strong></div><p class="shared-note">{t.rateNote}</p></div>
  </div>;
}

export function CrashZeroGrid({ items, label }: { items: readonly boolean[]; label: string }) {
  return <HundredGrid items={items} label={label} renderCell={zero => <div class={`cr-zero-cell ${zero ? 'zero' : ''}`} aria-hidden="true"></div>} />;
}
