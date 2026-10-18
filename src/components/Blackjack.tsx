import { useEffect, useRef, useState } from 'preact/hooks';
import {
  Table, advanceDealer, autoBlackjackRound, availableActions, blackjackLossRates, countView, roundView,
  settleBlackjackRounds, suggestedAction, BLACKJACK_FAST_ROUNDS, BLACKJACK_PAYOUTS,
  type Action, type BlackjackPayout, type BlackjackRound, type Round, type Strategy,
} from '../engine/blackjack';
import { appendRound, lossAmount, newSession } from '../engine/session';
import { defaultRng } from '../engine/rng';
import { counted, formatCopy, makeCopy } from '../i18n/copy';
import { money, type Locale } from '../i18n/site';
import source from '../../i18n/source/Blackjack.json';
import SegmentedControl from './shared/SegmentedControl';
import PnlHeader, { pnlColor } from './shared/PnlHeader';
import PnlChart from './shared/PnlChart';
import LossConversion from './shared/LossConversion';
import HundredGrid from './shared/HundredGrid';
import './Blackjack.css';

const COPY = {
  tables: '同时开', tableLabel: '同时开几桌', bet: '每注', betLabel: '每注多少', payout: '黑杰克赔', payoutLabel: '黑杰克赔率',
  strategy: '自动玩时的策略', strategyLabel: '自动策略', basic: '基本策略', mimic: '学庄家', never: '永不爆牌',
  basicNote: '数学上最优的打法：每一手按固定表格决定要牌、停牌、加倍或分牌。',
  mimicNote: '和庄家一样：不到 17 点就要牌，从不加倍或分牌。', neverNote: '只要可能爆牌就停：硬 12 点以上停牌，从不加倍或分牌。',
  pnl: '你的盈亏', meta: '已玩 {{rounds}} 局 · 共 {{bets}} 手', lost: '输掉的钱 {{itemText}}',
  H: '要牌', S: '停牌', D: '加倍', P: '分牌', bj: '黑杰克', win: '赢', dbust: '庄家爆牌，你赢', lose: '输', bust: '爆牌', push: '平局，退回', dbj: '庄家黑杰克',
  dealer: '庄家', you: '你', doubled: '已加倍', start: '点“发牌”开始', drawing: '庄家摸牌中…', dealing: '发牌中…',
  yourTurn: '轮到你：要牌、停牌、加倍或分牌', countStart: 'Hi-Lo 计数：发牌后开始',
  hintOn: '提示：开', hintOff: '提示：关', countOn: '算牌：开', countOff: '算牌：关',
  deal: '发牌', auto: '自动玩', stop: '停下', fast: '快进 100 局', reset: '重来',
  youWin: '你赢', youLose: '你输', pushed: '平局', emptyScore: '你 – : 庄 –',
  chart: '你的盈亏随局数变化，虚线为数学期望', curveNote: '实线是你，虚线是数学期望。你亲手打的局按基本策略计期望。',
  minute: '每分钟平均输', night: '玩一个通宵（8 小时）', rateNote: '按所选策略、每桌每小时约 70 局的假设和数学期望计算。',
};
const T = makeCopy(COPY, source);
const STEP_MS = 450, MULTI_MS = 800, PAUSE_MS = 900;
const ACTIONS: Action[] = ['H', 'S', 'D', 'P'];
interface Play { round: Round; bet: number; payout: BlackjackPayout; strategy: Strategy }
export interface Props { locale: Locale; defaultTables?: 1 | 10 | 100 }
export default function Blackjack({ locale, defaultTables = 1 }: Props) {
  const t = T[locale];
  const [tables, setTables] = useState<number>(defaultTables), [bet, setBet] = useState(10);
  const [payout, setPayout] = useState<BlackjackPayout>(1.5), [strategy, setStrategy] = useState<Strategy>('basic');
  const [hint, setHint] = useState(true), [count, setCount] = useState(false), [auto, setAuto] = useState(false);
  const [busy, setBusy] = useState(false), [, setVersion] = useState(0);
  const [session, setSession] = useState(() => newSession<BlackjackRound>());
  const sessionRef = useRef(session), play = useRef<Play | null>(null), results = useRef<BlackjackRound['results']>([]);
  const tableRefs = useRef<Table[]>([]);
  const autoRef = useRef(false), busyRef = useRef(false), timer = useRef<number | null>(null), nextTimer = useRef<number | null>(null);
  const bump = () => setVersion(v => v + 1);
  const ensureTables = () => { if (!tableRefs.current.length) tableRefs.current = Array.from({ length: tables }, () => new Table(defaultRng)); return tableRefs.current; };
  const cancelStep = () => { if (timer.current !== null) { clearTimeout(timer.current); timer.current = null; } };
  const cancelNext = () => { if (nextTimer.current !== null) { clearTimeout(nextTimer.current); nextTimer.current = null; } };
  const later = (fn: () => void, ms = STEP_MS) => { cancelStep(); timer.current = window.setTimeout(() => { timer.current = null; fn(); }, ms); };
  const markBusy = (value: boolean) => { busyRef.current = value; setBusy(value); };
  const midRound = () => Boolean(play.current && play.current.round.phase !== 'done');
  useEffect(() => () => { autoRef.current = false; cancelStep(); cancelNext(); }, []);
  const commit = (next: typeof session) => { sessionRef.current = next; setSession(next); };
  const scheduleNext = () => {
    cancelNext();
    if (autoRef.current) nextTimer.current = window.setTimeout(() => { nextTimer.current = null; if (autoRef.current) dealRef.current(); }, PAUSE_MS);
  };
  const finish = (round: BlackjackRound) => {
    results.current = round.results; commit(appendRound(sessionRef.current, round)); markBusy(false); bump(); scheduleNext();
  };
  const dealerStep = () => {
    const current = play.current; if (!current || current.round.phase !== 'dealer') return;
    const phase = advanceDealer(tableRefs.current[0], current.round, current.payout); bump();
    if (phase === 'done') finish(settleBlackjackRounds([current.round], current.bet, current.strategy, current.payout));
    else later(() => dealerRef.current());
  };
  const dealerRef = useRef(dealerStep); dealerRef.current = dealerStep;
  const afterAction = () => {
    bump();
    if (play.current?.round.phase === 'dealer') { markBusy(true); later(() => dealerRef.current()); }
    else if (autoRef.current) later(() => autoStepRef.current());
  };
  const autoStep = () => {
    const current = play.current;
    if (!autoRef.current || !current) return;
    const action = suggestedAction(tableRefs.current[0], current.round, current.strategy);
    if (action) { tableRefs.current[0].act(current.round, action); afterAction(); }
  };
  const autoStepRef = useRef(autoStep); autoStepRef.current = autoStep;
  const deal = () => {
    if (busyRef.current || midRound()) return;
    cancelNext(); const currentTables = ensureTables(); results.current = [];
    if (tables === 1) {
      const round = currentTables[0].start();
      play.current = { round, bet, payout, strategy: autoRef.current ? strategy : 'basic' }; bump();
      if (round.phase === 'dealer') { markBusy(true); later(() => dealerRef.current(), STEP_MS + 100); }
      else if (autoRef.current) later(() => autoStepRef.current(), STEP_MS + 100);
    } else {
      play.current = null; markBusy(true); bump();
      later(() => finish(autoBlackjackRound(currentTables, bet, strategy, payout)), MULTI_MS);
    }
  };
  const dealRef = useRef(deal); dealRef.current = deal;
  const act = (action: Action) => {
    const current = play.current;
    if (busyRef.current || autoRef.current || !current || !availableActions(tableRefs.current[0], current.round)[action]) return;
    tableRefs.current[0].act(current.round, action); afterAction();
  };
  const toggleAuto = () => {
    const value = !autoRef.current; autoRef.current = value; setAuto(value); cancelNext();
    if (!value) { if (play.current?.round.phase === 'player') cancelStep(); return; }
    if (busyRef.current) return;
    if (midRound()) { play.current!.strategy = strategy; later(() => autoStepRef.current(), 10); }
    else dealRef.current();
  };
  const fast = () => {
    if (busyRef.current || midRound()) return;
    cancelNext(); const currentTables = ensureTables(); let next = sessionRef.current;
    for (let i = 0; i < BLACKJACK_FAST_ROUNDS; i++) next = appendRound(next, autoBlackjackRound(currentTables, bet, strategy, payout));
    play.current = null; results.current = next.last!.results; commit(next); bump(); scheduleNext();
  };
  const reset = () => {
    autoRef.current = false; cancelStep(); cancelNext(); setAuto(false); markBusy(false);
    tableRefs.current = []; play.current = null; results.current = []; commit(newSession<BlackjackRound>()); bump();
  };
  const changeTables = (n: number) => {
    if (busyRef.current || midRound()) return;
    setTables(n); tableRefs.current = []; play.current = null; results.current = []; bump();
  };
  const locked = busy || midRound(), current = play.current;
  const one = current ? roundView(current.round, current.bet) : results.current[0];
  const table = tableRefs.current[0];
  const available = table ? availableActions(table, current?.round ?? null) : { H: false, S: false, D: false, P: false };
  const suggested = table ? suggestedAction(table, current?.round ?? null, auto ? current?.strategy ?? strategy : 'basic') : null;
  const counting = table ? countView(table) : null;
  const sign = (value: number, digits?: number) => `${value > 0 ? '+' : ''}${digits === undefined ? value : value.toFixed(digits)}`;
  const hintText = hint && suggested ? locale === 'en'
    ? `${auto ? `${t[current!.strategy]}: ` : 'Basic strategy suggests: '}${t[suggested]}`
    : `${auto ? `${t[current!.strategy]}：` : '基本策略建议：'}${t[suggested]}` : '';
  const countText = !count ? '' : !counting ? t.countStart : locale === 'en'
    ? `Hi-Lo count ${sign(counting.running)} · true count ${sign(counting.true, 1)} · decks left: ${counting.decks.toFixed(1)}`
    : `Hi-Lo 计数 ${sign(counting.running)} · 真数 ${sign(counting.true, 1)} · 牌靴剩 ${counting.decks.toFixed(1)} 副`;
  const valueText = (value: NonNullable<typeof one>['hands'][number]['value']) => {
    if (value.bust) return locale === 'en' ? `${value.t} bust` : `${value.t} 爆`;
    if (value.natural) return locale === 'en' ? 'Blackjack (21)' : '21 黑杰克';
    return `${value.soft && value.t < 21 ? locale === 'en' ? 'Soft ' : '软 ' : ''}${value.t}`;
  };
  const scoreText = (result: NonNullable<typeof one>) => {
    const mine = result.hands.map(h => h.value.bust ? locale === 'en' ? 'Bust' : '爆' : h.value.t).join('/');
    const dealer = result.dealer.value!.bust ? locale === 'en' ? 'Bust' : '爆' : result.dealer.value!.t;
    return locale === 'en' ? `You ${mine} : Dealer ${dealer}` : `你 ${mine} : 庄 ${dealer}`;
  };
  const outcomeText = (result: NonNullable<typeof one>) => {
    const suffix = result.hands[0].tag === 'bj' ? ` · ${t.bj}` : '';
    if (locale === 'en') return `${result.net > 0 ? 'You win' : result.net < 0 ? 'You lose' : 'Push'}${result.net ? ` ${money(result.net, locale, false)}` : ''}${suffix}`;
    return `${result.net > 0 ? '赢 ' : result.net < 0 ? '输 ' : '平 '}${result.net ? money(result.net, locale) : ''}${suffix}`;
  };
  let resultText = tables === 1 ? '' : t.start;
  if (busy && tables > 1) resultText = t.dealing;
  else if (current?.round.phase === 'player') resultText = auto ? '' : t.yourTurn;
  else if (current?.round.phase === 'dealer') resultText = t.drawing;
  else if (results.current.length && session.last) resultText = tables === 1
    ? `${locale === 'en' ? 'This round ' : '本局 '}${money(session.last.delta, locale)}`
    : locale === 'en' ? `This round: ${counted(session.last.wins, 'table')} won · ${counted(session.last.losses, 'table')} lost · ${session.last.pushes} pushed · ${money(session.last.delta, locale)}`
      : `本局：赢 ${session.last.wins} 桌 · 输 ${session.last.losses} 桌 · 平 ${session.last.pushes} 桌 · ${money(session.last.delta, locale)}`;
  const rows = one ? [
    { name: t.dealer, sub: '', value: one.dealer.value ? valueText(one.dealer.value) : locale === 'en' ? `Showing ${one.dealer.up === 11 ? 'A' : one.dealer.up}` : `明牌 ${one.dealer.up === 11 ? 'A' : one.dealer.up}`, cards: one.dealer.cards, active: false, bust: false, net: 0, tag: '' },
    ...one.hands.map((hand, i) => ({ name: one.hands.length > 1 ? locale === 'en' ? `You · Hand ${i + 1}` : `你 · 第 ${i + 1} 手` : t.you,
      sub: hand.doubled ? t.doubled : '', value: valueText(hand.value), cards: hand.cards, active: hand.active, bust: hand.value.bust,
      net: hand.net, tag: one.phase === 'done' && hand.tag ? `${t[hand.tag]}${hand.net ? ` ${money(hand.net, locale, locale === 'zh')}` : ''}` : '' })),
  ] : [
    { name: t.dealer, sub: '', value: '', cards: [], active: false, bust: false, net: 0, tag: '' },
    { name: t.you, sub: '', value: '', cards: [], active: false, bust: false, net: 0, tag: t.start },
  ];
  const rates = blackjackLossRates(tables, bet, strategy, payout);
  return <div class="bj" data-blackjack>
    <div class="bj-controls">
      <div class="bj-row"><strong>{t.tables}</strong><SegmentedControl label={t.tableLabel} values={[1, 10, 100]} value={tables} format={n => locale === 'en' ? counted(n, 'table') : `${n} 桌`} onChange={changeTables} disabled={locked} /></div>
      <div class="bj-row"><strong>{t.bet}</strong><SegmentedControl label={t.betLabel} values={[10, 100, 1000]} value={bet} format={n => locale === 'en' ? money(n, locale, false) : String(n)} onChange={setBet} disabled={locked} /></div>
      <div class="bj-row"><strong>{t.payout}</strong><SegmentedControl label={t.payoutLabel} values={BLACKJACK_PAYOUTS} value={payout} format={n => n === 1.5 ? '3:2' : '6:5'} onChange={setPayout} disabled={locked} /></div>
      <div class="bj-strategy"><strong>{t.strategy}</strong><SegmentedControl label={t.strategyLabel} values={['basic', 'mimic', 'never'] as Strategy[]} value={strategy} format={s => t[s]} onChange={setStrategy} disabled={locked} /><p class="shared-note">{t[`${strategy}Note`]}</p></div>
    </div>
    <PnlHeader pnl={session.pnl} locale={locale} label={t.pnl} meta={formatCopy(t.meta, { rounds: session.rounds, bets: session.bets }, locale)}><LossConversion loss={lossAmount(session.pnl)} locale={locale} label={t.lost} /></PnlHeader>
    <div class="bj-table" aria-busy={busy}>
      {tables === 1 ? <>
        <div class="bj-hands">{rows.map((row, i) => <div key={i} class={`bj-hand ${row.active ? 'active' : ''}`}>
          <div class="bj-row"><strong>{row.name} <small>{row.sub}</small></strong><span class="bj-total" style={{ color: row.bust ? 'var(--loss)' : 'var(--ink)' }}>{row.value}</span></div>
          <div class="bj-cards" style={{ '--card-overlap': row.cards.length > 6 ? '-28px' : '-12px' }}>
            {row.cards.map((card, index) => <div key={index} class={`bj-card ${card ? '' : 'back'}`} aria-label={card ? `${card.r} ${card.s}` : undefined}><span>{card?.r}</span><span>{card?.s}</span></div>)}
          </div><span class="bj-hand-tag" style={{ color: row.net ? pnlColor(row.net) : 'var(--muted)' }}>{row.tag}</span>
        </div>)}</div>
        <div class="bj-hand-actions">{ACTIONS.map(action => <button type="button" key={action} data-action={action} disabled={!available[action] || busy || auto} onClick={() => act(action)}>{t[action]}</button>)}</div>
        <div class="bj-hints" aria-live="polite"><span class="bj-hint">{hintText}</span><span class="bj-count">{countText}</span></div>
        <div class="bj-toggles"><button type="button" aria-pressed={hint} onClick={() => setHint(!hint)}>{hint ? t.hintOn : t.hintOff}</button><button type="button" aria-pressed={count} onClick={() => setCount(!count)}>{count ? t.countOn : t.countOff}</button></div>
      </> : tables === 10 ? <div class="bj-ten">{Array.from({ length: tables }, (_, i) => {
        const result = busy ? null : results.current[i];
        return <div key={i} class={`bj-tile ${result ? result.net > 0 ? 'win' : result.net < 0 ? 'loss' : 'push' : ''}`}><span>{result ? scoreText(result) : busy ? t.dealing : t.emptyScore}</span><strong>{result ? outcomeText(result) : '\u00a0'}</strong></div>;
      })}</div> : <>
        <HundredGrid items={Array.from({ length: tables }, (_, i) => busy ? null : results.current[i])} label={t.tableLabel} renderCell={result => <div class={`bj-cell ${result ? result.net > 0 ? 'win' : result.net < 0 ? 'loss' : 'push' : ''}`} aria-label={result ? outcomeText(result) : busy ? t.dealing : t.start}>{result ? result.net > 0 ? '+' : result.net < 0 ? '−' : '=' : ''}</div>} />
        <div class="bj-legend"><span>+ {t.youWin}</span><span>= {t.pushed}</span><span>− {t.youLose}</span></div>
      </>}
      <div class="bj-result" role="status" style={{ color: !locked && results.current.length && session.last ? pnlColor(session.last.delta) : 'var(--muted)' }}>{resultText}</div>
    </div>
    <div class="bj-actions"><button type="button" class="btn btn-primary" disabled={locked} onClick={deal}>{t.deal}</button><button type="button" class="btn btn-outline" aria-pressed={auto} onClick={toggleAuto}>{auto ? t.stop : t.auto}</button><button type="button" class="btn btn-soft" disabled={locked} onClick={fast}>{t.fast}</button><button type="button" class="btn btn-ghost" onClick={reset}>{t.reset}</button></div>
    <PnlChart history={session.history} pnl={session.pnl} label={t.chart} note={t.curveNote} />
    <div class="bj-rate"><div class="bj-row"><span>{t.minute}</span><strong class="bj-minute">{money(rates.perMinute, locale, false)}</strong></div><div class="bj-row"><span>{t.night}</span><strong class="bj-mono">{money(Math.round(rates.perNight), locale, false)}</strong></div><p class="shared-note">{t.rateNote}</p></div>
  </div>;
}

/** Fractional cells illustrate the prototype's reference frequencies, not fresh bets. */
export function BlackjackBustGrid({ sample, playerBusts, bothBusts, label }: { sample: number; playerBusts: number; bothBusts: number; label: string }) {
  return <HundredGrid items={Array.from({ length: sample }, (_, i) => ({ player: i < playerBusts, fill: Math.max(0, Math.min(1, bothBusts - i)) }))} label={label} className="bj-bust-grid" renderCell={cell => <div class={`bj-bust-cell ${cell.player ? 'player-bust' : ''} ${cell.fill ? 'both-bust' : ''}`} style={{ background: cell.fill ? `linear-gradient(90deg, var(--highlight) ${cell.fill * 100}%, transparent ${cell.fill * 100}%)` : 'transparent' }} aria-hidden="true"></div>} />;
}
