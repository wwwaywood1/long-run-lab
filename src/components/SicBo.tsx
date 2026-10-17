import { useEffect, useRef, useState } from 'preact/hooks';
import { rollDice, rollRound, sicboLossRates, sum, SICBO_FAST_ROUNDS, type Dice, type SicBoBet, type SicBoGame, type SicBoRound } from '../engine/sicbo';
import { appendRound, lossAmount, newSession } from '../engine/session';
import { defaultRng } from '../engine/rng';
import { money, type Locale } from '../i18n/site';
import { counted, formatCopy, makeCopy } from '../i18n/copy';
import source from '../../i18n/source/SicBo.json';
import SegmentedControl from './shared/SegmentedControl';
import PnlHeader, { pnlColor } from './shared/PnlHeader';
import PnlChart from './shared/PnlChart';
import LossConversion from './shared/LossConversion';
import HundredGrid from './shared/HundredGrid';
import './SicBo.css';

const COPY = {
  tables: '同时开', tableUnit: ' 桌', tablesLabel: '同时开几桌', bet: '每注', betLabel: '每注多少',
  pick: '押', pickLabel: '押什么', big: '大', small: '小', triple: '豹子',
  noteBig: '11–17 点赢，1 赔 1。遇到豹子算输。', noteSmall: '4–10 点赢，1 赔 1。遇到豹子算输。', noteTriple: '三颗一样就赢，30 赔 1。',
  pnl: '你的盈亏', lost: '输掉的钱 {{itemText}}', meta: '已摇 {{rounds}} 局 · 共 {{bets}} 注',
  roll: '摇一把', auto: '自动摇', stop: '停下', fast: '快进 100 局', reset: '重来',
  rolling: '摇骰中…', start: '点“摇一把”开始', win: '你赢', loss: '你输', won: '赢', lostWord: '输',
  tripleHead: '豹子！三个 ', point: ' 点 · ', roundWins: '本局：赢 ', roundLosses: ' 桌 · 输 ', roundTriples: ' 桌 · 豹子 ', roundEnd: ' 桌 · ',
  chart: '你的盈亏随局数变化，虚线为数学期望', curveNote: '实线是你，虚线是数学期望。',
  minute: '每分钟平均输', night: '玩一个通宵（8 小时）', rateNote: '按每桌每小时约 60 局的假设和数学期望计算。',
};
const T = makeCopy(COPY, source);
const ROLL_MS = 900, TICK_MS = 75, PAUSE_MS = 650;
// Pip positions describe glyph geometry, not game rules.
const PIPS: Record<number, number[]> = { 1: [4], 2: [2, 6], 3: [2, 4, 6], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
function Die({ value, size, dark, rotation = 0, dy = 0 }: { value: number; size: number; dark: boolean; rotation?: number; dy?: number }) {
  return <div class={`sb-die ${dark ? 'dark' : ''}`} aria-hidden="true" style={{ width: size, height: size, padding: Math.round(size * .14), borderRadius: Math.round(size * .2), transform: `translateY(${dy}px) rotate(${rotation}deg)` }}>
    {Array.from({ length: 9 }, (_, index) => <span key={index} style={{ width: Math.max(4, Math.round(size * .17)), height: Math.max(4, Math.round(size * .17)), opacity: PIPS[value].includes(index) ? 1 : 0 }} />)}
  </div>;
}
interface Visual { dice: Dice; rotations: number[]; dy: number[]; result: SicBoGame | null }
// Idle faces follow the design's decorative pattern; they are never settled as bets.
const blankGames = (n: number): Visual[] => Array.from({ length: n }, (_, i) => ({ dice: [i % 6 + 1, (i + 2) % 6 + 1, (i + 4) % 6 + 1], rotations: [0, 0, 0], dy: [0, 0, 0], result: null }));
export interface Props { locale: Locale; defaultTables?: 1 | 10 | 100 }
export default function SicBo({ locale, defaultTables = 1 }: Props) {
  const t = T[locale];
  const [tables, setTables] = useState<number>(defaultTables), [bet, setBet] = useState(10), [pick, setPick] = useState<SicBoBet>('big');
  const [games, setGames] = useState(() => blankGames(defaultTables));
  const [session, setSession] = useState(() => newSession<SicBoRound>());
  const sessionRef = useRef(session);
  const [rolling, setRolling] = useState(false), [auto, setAuto] = useState(false);
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
    if (autoRef.current) nextTimer.current = later(() => { nextTimer.current = null; if (autoRef.current) rollRef.current(); }, PAUSE_MS);
  };
  const roll = () => {
    if (busy.current) return;
    busy.current = true; cancelNext(); setRolling(true);
    const round = rollRound(tables, pick, bet, defaultRng);
    setGames(games.map(game => ({ ...game, result: null })));
    tick.current = window.setInterval(() => setGames(Array.from({ length: tables }, () => ({
      dice: rollDice(defaultRng), rotations: Array.from({ length: 3 }, () => Math.random() * 50 - 25),
      dy: Array.from({ length: 3 }, () => Math.random() * -14), result: null,
    }))), TICK_MS);
    later(() => {
      clearTick();
      setGames(round.games.map(result => ({ dice: result.dice, rotations: [0, 0, 0], dy: [0, 0, 0], result })));
      commit(appendRound(sessionRef.current, round)); busy.current = false; setRolling(false); scheduleNext();
    }, ROLL_MS);
  };
  const rollRef = useRef(roll); rollRef.current = roll;
  const toggleAuto = () => {
    const next = !autoRef.current; autoRef.current = next; setAuto(next); cancelNext();
    if (next && !busy.current) rollRef.current();
  };
  const fast = () => {
    if (busy.current) return;
    cancelNext(); let next = sessionRef.current;
    for (let i = 0; i < SICBO_FAST_ROUNDS; i++) next = appendRound(next, rollRound(tables, pick, bet, defaultRng));
    commit(next); setGames(next.last!.games.map(result => ({ dice: result.dice, rotations: [0, 0, 0], dy: [0, 0, 0], result }))); scheduleNext();
  };
  const reset = () => {
    timers.current.forEach(clearTimeout); timers.current.clear(); nextTimer.current = null; clearTick();
    autoRef.current = false; busy.current = false; setRolling(false); setAuto(false);
    setGames(blankGames(tables)); commit(newSession<SicBoRound>());
  };
  const changeTables = (n: number) => { if (!busy.current) { setTables(n); setGames(blankGames(n)); } };
  const rates = sicboLossRates(tables, bet, pick);
  const last = session.last;
  let result = t.start;
  if (rolling) result = t.rolling;
  else if (last && games[0].result) {
    if (tables === 1) {
      const game = last.games[0];
      const head = locale === 'en' ? (game.kind === 'triple' ? `Triple! All three dice show ${game.dice[0]}` : `${game.dice.join(' + ')} = ${game.total} pts · ${t[game.kind]}`) : game.kind === 'triple' ? `${t.tripleHead}${game.dice[0]}` : `${game.dice.join(' + ')} = ${game.total}${t.point}${t[game.kind]}`;
      result = `${head} · ${game.win ? t.win : t.loss} ${money(last.delta, locale, locale === 'zh')}`;
    } else result = locale === 'en' ? `This round: ${counted(last.wins, 'table')} won · ${counted(last.losses, 'table')} lost · ${counted(last.triples, 'triple')} · ${money(last.delta, locale)}` : `${t.roundWins}${last.wins}${t.roundLosses}${last.losses}${t.roundTriples}${last.triples}${t.roundEnd}${money(last.delta, locale, locale === 'zh')}`;
  }
  const diceView = (game: Visual, size: number) => <div class="sb-dice" role="img" aria-label={game.dice.join(' · ')}>
    {game.dice.map((value, index) => <Die key={index} value={value} size={size} dark={game.result?.kind === 'triple'} rotation={game.rotations[index]} dy={tables === 1 ? game.dy[index] : 0} />)}
  </div>;
  return <div class="sb" data-sicbo>
    <div class="sb-controls">
      <div class="sb-row"><strong>{t.tables}</strong><SegmentedControl label={t.tablesLabel} values={[1, 10, 100]} value={tables} format={n => locale === 'en' ? counted(n, 'table') : `${n}${t.tableUnit}`} onChange={changeTables} disabled={rolling} /></div>
      <div class="sb-row"><strong>{t.bet}</strong><SegmentedControl label={t.betLabel} values={[10, 100, 1000]} value={bet} format={n => locale === 'zh' ? String(n) : money(n, locale, false)} onChange={setBet} disabled={rolling} /></div>
      <div class="sb-row"><strong>{t.pick}</strong><SegmentedControl label={t.pickLabel} values={['big', 'small', 'triple'] as SicBoBet[]} value={pick} format={s => t[s]} onChange={setPick} disabled={rolling} /></div>
      <p class="shared-note">{pick === 'big' ? t.noteBig : pick === 'small' ? t.noteSmall : t.noteTriple}</p>
    </div>
    <PnlHeader pnl={session.pnl} locale={locale} label={t.pnl} meta={formatCopy(t.meta, { rounds: session.rounds, bets: session.bets }, locale)}>
      <LossConversion loss={lossAmount(session.pnl)} locale={locale} label={t.lost} />
    </PnlHeader>
    <div class="sb-table" aria-busy={rolling}>
      {tables === 1 ? <div class="sb-one">{diceView(games[0], 76)}</div> : tables === 10 ? <div class="sb-ten">{games.map((game, i) => <div key={i} class="sb-tile" style={{ boxShadow: game.result ? `0 0 0 2.5px ${pnlColor(game.result.net)}` : 'none' }}>
        {diceView(game, 30)}<span style={{ color: game.result ? pnlColor(game.result.net) : 'var(--muted)' }}>{game.result ? `${game.result.total} ${t[game.result.kind]} · ${game.result.win ? t.won : t.lostWord}` : '…'}</span>
      </div>)}</div> : <>
        <HundredGrid items={games} label={t.tablesLabel} renderCell={game => {
          const g = game.result;
          const kind = g ? g.win ? 'win' : g.kind === 'triple' ? 'triple' : 'loss' : 'pending';
          return <div class={`sb-cell ${kind}`} aria-label={g ? `${g.total} ${t[g.kind]} · ${g.win ? t.win : t.loss}` : t.rolling}>
            {g ? g.total : rolling ? sum(game.dice) : ''}<span class="sb-outcome">{g ? g.win ? '+' : '−' : ''}</span>
          </div>;
        }} />
        <div class="sb-legend"><span>+ {t.win}</span><span>− {t.loss}</span><span class="sb-triple-key">{t.triple}</span></div>
      </>}
      <div class="sb-result" role="status" style={{ color: !rolling && games[0].result && last ? pnlColor(last.delta) : 'var(--muted)' }}>{result}</div>
    </div>
    <div class="sb-actions">
      <button type="button" class="btn btn-primary" disabled={rolling} onClick={roll}>{t.roll}</button>
      <button type="button" class="btn btn-outline" aria-pressed={auto} onClick={toggleAuto}>{auto ? t.stop : t.auto}</button>
      <button type="button" class="btn btn-soft" disabled={rolling} onClick={fast}>{t.fast}</button>
      <button type="button" class="btn btn-ghost" onClick={reset}>{t.reset}</button>
    </div>
    <PnlChart history={session.history} pnl={session.pnl} label={t.chart} note={t.curveNote} />
    <div class="sb-rate">
      <div class="sb-row"><span>{t.minute}</span><strong class="sb-minute">{money(rates.perMinute, locale, false)}</strong></div>
      <div class="sb-row"><span>{t.night}</span><strong class="sb-mono">{money(Math.round(rates.perNight), locale, false)}</strong></div>
      <p class="shared-note">{t.rateNote}</p>
    </div>
  </div>;
}
