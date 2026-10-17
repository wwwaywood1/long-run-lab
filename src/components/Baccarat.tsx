import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import {
  appendRound, BACCARAT_FAST_ROUNDS, dealRound, lossRates, newSession, sessionLoss,
  visibleHand, type BaccaratRound, type Shoe, type Side,
} from '../engine/baccarat';
import { defaultRng } from '../engine/rng';
import { lossToItems } from '../engine/items';
import { money, type Locale } from '../i18n/site';
import { makeCopy } from '../i18n/copy';
import source from '../../i18n/source/Baccarat.json';
import './Baccarat.css';

const COPY = {
  tables: '同时开', tableUnit: ' 桌', tablesLabel: '同时开几桌', bet: '每注', betLabel: '每注多少',
  pick: '押', pickLabel: '押什么', pnl: '你的盈亏', lost: '输掉的钱',
  meta: '已发 {{rounds}} 局 · 共 {{bets}} 注', B: '庄', P: '闲', T: '和',
  noteB: '庄赢 1 赔 0.95（抽水 5%），和局退回。', noteP: '闲赢 1 赔 1，和局退回。', noteT: '和局 8 赔 1，庄或闲赢都算输。',
  deal: '发一局', auto: '自动发', stop: '停下', fast: '快进 100 局', reset: '重来',
  dealing: '发牌中…', start: '点“发一局”开始', win: '你赢', loss: '你输', push: '退回',
  winSuffix: '赢', tieSuffix: '局', tiePush: '和局退回', principal: '本金退回', point: ' 点', tied: ' · 和', won: ' · 赢',
  empty: '闲 – : 庄 –', scoreP: '闲 ', scoreB: ' : 庄 ', tie: '和局 ', wonP: '赢 · 闲 ',
  roundWins: '本局：赢 ', roundLosses: ' 桌 · 输 ', roundPushes: ' 桌 · 和 ', roundEnd: ' 桌 · ',
  road: '路单', roadNote: '第 1 桌 · 从上往下，从左往右',
  chart: '你的盈亏随局数变化，虚线为数学期望', curveNote: '实线是你，虚线是数学期望。',
  minute: '每分钟平均输', night: '玩一个通宵（8 小时）',
  rateNote: '按每桌每小时约 70 局的假设和数学期望计算。',
};
const T = makeCopy(COPY, source);
const CARD_MS = 380, MULTI_MS = 900, PAUSE_MS = 900;
const tone = (value: number) => value < 0 ? 'var(--loss)' : value > 0 ? 'var(--you)' : 'var(--muted)';
export interface Props { locale: Locale; defaultTables?: 1 | 10 | 100 }

export default function Baccarat({ locale, defaultTables = 1 }: Props) {
  const t = T[locale];
  const [tables, setTables] = useState<number>(defaultTables);
  const [bet, setBet] = useState(10);
  const [pick, setPick] = useState<Side>('B');
  const [session, setSession] = useState(newSession);
  const sessionRef = useRef(session);
  const shoes = useRef<Shoe[]>([]);
  const [round, setRound] = useState<BaccaratRound | null>(null);
  const [revealed, setRevealed] = useState(0);
  const [dealing, setDealing] = useState(false);
  const busy = useRef(false);
  const [auto, setAuto] = useState(false);
  const autoRef = useRef(false);
  const timers = useRef(new Set<number>());
  const nextTimer = useRef<number | null>(null);
  const later = (fn: () => void, ms: number) => {
    const id = window.setTimeout(() => { timers.current.delete(id); fn(); }, ms);
    timers.current.add(id);
    return id;
  };
  const cancelNext = () => {
    if (nextTimer.current !== null) {
      clearTimeout(nextTimer.current); timers.current.delete(nextTimer.current); nextTimer.current = null;
    }
  };
  useEffect(() => () => {
    autoRef.current = false;
    timers.current.forEach(clearTimeout);
    timers.current.clear();
  }, []);
  const commit = (next: ReturnType<typeof newSession>) => { sessionRef.current = next; setSession(next); };
  const scheduleNext = () => {
    cancelNext();
    if (autoRef.current) nextTimer.current = later(() => {
      nextTimer.current = null;
      if (autoRef.current) dealRef.current();
    }, PAUSE_MS);
  };
  const deal = () => {
    if (busy.current) return;
    cancelNext(); busy.current = true; setDealing(true); setRevealed(0);
    const next = dealRound(shoes.current, tables, pick, bet, defaultRng);
    setRound(next);
    const settle = () => {
      commit(appendRound(sessionRef.current, next));
      busy.current = false; setDealing(false); setRevealed(99); scheduleNext();
    };
    if (tables === 1) {
      const total = next.hands[0].player.length + next.hands[0].banker.length;
      const reveal = (count: number) => {
        setRevealed(count);
        if (count < total) later(() => reveal(count + 1), CARD_MS);
        else later(settle, CARD_MS);
      };
      later(() => reveal(1), 120);
    } else later(settle, MULTI_MS);
  };
  const dealRef = useRef(deal);
  dealRef.current = deal;
  const toggleAuto = () => {
    const next = !autoRef.current;
    autoRef.current = next; setAuto(next);
    cancelNext();
    if (next && !busy.current) dealRef.current();
  };
  const fast = () => {
    if (busy.current) return;
    cancelNext();
    let next = sessionRef.current;
    for (let i = 0; i < BACCARAT_FAST_ROUNDS; i++) {
      next = appendRound(next, dealRound(shoes.current, tables, pick, bet, defaultRng));
    }
    commit(next); setRound(next.last); setRevealed(99); scheduleNext();
  };
  const reset = () => {
    timers.current.forEach(clearTimeout); timers.current.clear(); nextTimer.current = null;
    autoRef.current = false; busy.current = false; shoes.current = [];
    setAuto(false); setDealing(false); setRound(null); setRevealed(0); commit(newSession());
  };
  const changeTables = (n: number) => {
    if (busy.current) return;
    setTables(n); setRound(null); setRevealed(0);
  };
  const chart = useMemo(() => {
    const history = session.history;
    let top = 10, bottom = -10;
    for (const h of history) { top = Math.max(top, h.p, h.e); bottom = Math.min(bottom, h.p, h.e); }
    const pad = (top - bottom) * 0.08; top += pad; bottom -= pad;
    const y = (v: number) => (6 + (top - v) / (top - bottom) * 108).toFixed(1);
    const path = (key: 'p' | 'e') => history.length < 2 ? `M0 ${y(0)} L342 ${y(0)}`
      : 'M' + history.map((h, i) => `${(i / (history.length - 1) * 342).toFixed(1)} ${y(h[key])}`).join(' L');
    return { zero: y(0), p: path('p'), e: path('e') };
  }, [session.history]);
  const conv = lossToItems(sessionLoss(session), locale);
  const rate = lossRates(tables, bet, pick);
  const settled = round !== null && !dealing;
  let result = t.start;
  if (dealing) result = t.dealing;
  else if (round) {
    if (tables === 1) {
      const h = round.hands[0];
      const head = h.win === 'T' ? `${t.tie}${h.pt} : ${h.bt}` : `${t[h.win]}${t.wonP}${h.pt}${t.scoreB}${h.bt}`;
      result = `${head} · ${h.outcome === 'push' ? t.principal : `${t[h.outcome]} ${money(round.delta, locale)}`}`;
    } else result = `${t.roundWins}${round.wins}${t.roundLosses}${round.losses}${t.roundPushes}${round.pushes}${t.roundEnd}${money(round.delta, locale)}`;
  }
  const roadStart = session.road.length <= 72 ? 0 : session.road.length - (66 + (session.road.length % 6 || 6));
  const seg = <V extends string | number,>(label: string, values: V[], current: V, format: (v: V) => string, change: (v: V) => void) => (
    <div class="bc-seg" role="group" aria-label={label}>{values.map(v =>
      <button type="button" key={v} disabled={dealing} aria-pressed={v === current} onClick={() => { if (!busy.current) change(v); }}>{format(v)}</button>
    )}</div>
  );
  return <div class="bc" data-baccarat>
    <div class="bc-controls">
      <div class="bc-row"><span>{t.tables}</span>{seg(t.tablesLabel, [1, 10, 100], tables, n => `${n}${t.tableUnit}`, changeTables)}</div>
      <div class="bc-row"><span>{t.bet}</span>{seg(t.betLabel, [10, 100, 1000], bet, n => locale === 'zh' ? String(n) : `$${n}`, setBet)}</div>
      <div class="bc-row"><span>{t.pick}</span>{seg(t.pickLabel, ['B', 'P', 'T'] as Side[], pick, s => t[s], setPick)}</div>
      <p class="bc-note">{t[`note${pick}`]}</p>
    </div>
    <div class="bc-pnl" aria-live="polite" aria-atomic="true">
      <span class="bc-note">{t.pnl}</span>
      <span class="bc-value" style={{ color: session.pnl ? tone(session.pnl) : 'var(--ink)' }}>{money(session.pnl, locale)}</span>
      <span class="bc-note bc-mono" data-stats>{t.meta.replace('{{rounds}}', session.rounds.toLocaleString('en-US')).replace('{{bets}}', session.bets.toLocaleString('en-US'))}</span>
      {conv && <span class="bc-conversion">{t.lost} ≈ {conv.count} {conv.item.unit}</span>}
    </div>
    <div class="bc-table" aria-busy={dealing}>
      {tables === 1 ? <div class="bc-hands">{(['player', 'banker'] as const).map(side => {
        const key = side === 'player' ? 'P' : 'B';
        const h = round?.hands[0];
        const view = h ? visibleHand(h, side, revealed) : null;
        const won = settled && h?.win === key;
        return <div key={side} class="bc-hand" style={{ color: won && round?.pick === key ? 'var(--you)' : 'var(--ink)' }}>
          <div class="bc-row"><span>{t[key]}{settled && h ? h.win === 'T' ? t.tied : won ? t.won : '' : ''}</span><span class="bc-mono">{view?.total != null ? `${view.total}${t.point}` : ''}</span></div>
          <div class="bc-cards">{view?.cards.map((card, i) => <div key={i} class="bc-card"><span>{card.r}</span><span>{card.s}</span></div>)}</div>
        </div>;
      })}</div> : <div class={`bc-grid bc-grid-${tables}`}>
        {Array.from({ length: tables }, (_, i) => {
          const h = settled ? round.hands[i] : null;
          return <div key={i} class={`bc-tile ${h?.outcome ?? 'pending'}`} aria-label={h ? `${t[h.win]} · ${t[h.outcome]}` : t.start}>
            {tables === 10 ? <><span class="bc-note bc-mono">{h ? `${t.scoreP}${h.pt}${t.scoreB}${h.bt}` : dealing ? t.dealing : t.empty}</span><strong>{h ? `${t[h.win]}${h.win === 'T' ? t.tieSuffix : t.winSuffix} · ${t[h.outcome]}` : '\u00a0'}</strong></>
              : <>{h ? t[h.win] : ''}<span class="bc-outcome">{h ? h.outcome === 'win' ? '+' : h.outcome === 'loss' ? '−' : '=' : ''}</span></>}
          </div>;
        })}
      </div>}
      {tables === 100 && <div class="bc-legend"><span>+ {t.win}</span><span>− {t.loss}</span><span>= {t.tiePush}</span></div>}
      <div class="bc-result" role="status" style={{ color: settled && round ? tone(round.delta) : 'var(--muted)' }}>{result}</div>
    </div>
    <div class="bc-actions">
      <button type="button" class="btn btn-primary" disabled={dealing} onClick={deal}>{t.deal}</button>
      <button type="button" class="btn btn-outline" aria-pressed={auto} onClick={toggleAuto}>{auto ? t.stop : t.auto}</button>
      <button type="button" class="btn btn-soft" disabled={dealing} onClick={fast}>{t.fast}</button>
      <button type="button" class="btn btn-ghost" onClick={reset}>{t.reset}</button>
    </div>
    <div class="bc-road-wrap">
      <div class="bc-row"><strong>{t.road}</strong><span class="bc-note bc-road-note">{t.roadNote}</span></div>
      <div class="bc-road" role="img" aria-label={`${t.road} · ${session.road.slice(roadStart).map(s => t[s]).join('、')}`}>
        {Array.from({ length: 72 }, (_, i) => { const side = session.road[roadStart + i]; return <span aria-hidden="true" key={i} class={`bc-road-dot ${side ?? ''}`}>{side ? t[side] : ''}</span>; })}
      </div>
    </div>
    <div class="bc-chart">
      <svg viewBox="0 0 342 120" role="img" aria-label={t.chart}>
        <line x1="0" y1={chart.zero} x2="342" y2={chart.zero} stroke="var(--rule)" />
        <path d={chart.e} fill="none" stroke="var(--ink)" stroke-opacity="0.45" stroke-width="1.4" stroke-dasharray="5 4" />
        <path d={chart.p} fill="none" stroke={session.pnl ? tone(session.pnl) : 'var(--ink)'} stroke-width="2.4" stroke-linejoin="round" />
      </svg><p class="bc-note">{t.curveNote}</p>
    </div>
    <div class="bc-rate">
      <div class="bc-row"><span>{t.minute}</span><strong class="bc-rate-value">{money(rate.perMinute, locale, false)}</strong></div>
      <div class="bc-row"><span>{t.night}</span><strong class="bc-mono">{money(Math.round(rate.perNight), locale, false)}</strong></div>
      <p class="bc-note">{t.rateNote}</p>
    </div>
  </div>;
}
