import { useEffect, useRef, useState } from 'preact/hooks';
import {
  appendSportsRound, backSportsFavorites, createSportsSlips, fastSports, newSportsSession, pickSportsOutcome,
  revealSportsSlips, revealSportsStep, settleSportsRound, sportsReady, sportsSlipView,
  SPORTS_BETS, SPORTS_LEGS, SPORTS_TABLES, type Outcome, type SportsSlip,
} from '../engine/sports';
import { defaultRng } from '../engine/rng';
import { lossAmount } from '../engine/session';
import { counted } from '../i18n/copy';
import { SPORTS_COPY, legLabel, sportsLegNote, sportsMeta, sportsResult, sportsSlipText, sportsTeam, sportsTileText } from '../i18n/sports';
import { money, type Locale } from '../i18n/site';
import numbers from '../../data/numbers.json';
import SegmentedControl from './shared/SegmentedControl';
import PnlHeader, { pnlColor } from './shared/PnlHeader';
import PnlChart from './shared/PnlChart';
import LossConversion from './shared/LossConversion';
import HundredGrid from './shared/HundredGrid';
import './Sports.css';

const FIRST_MS = 250, STEP_MS = 380, MULTI_MS = 800, PAUSE_MS = 1000;
type Phase = 'pick' | 'playing' | 'done';
export interface Props { locale: Locale; defaultTables?: 1 | 10 | 100 }
export default function Sports({ locale, defaultTables = 1 }: Props) {
  const t = SPORTS_COPY[locale];
  const [config, setConfig] = useState({ tables: defaultTables as number, bet: 10, legs: 2 }), configRef = useRef(config);
  const [slips, setSlips] = useState<SportsSlip[]>([]), slipsRef = useRef(slips);
  const [phase, setPhase] = useState<Phase>('pick'), phaseRef = useRef(phase);
  const [session, setSession] = useState(newSportsSession), sessionRef = useRef(session);
  const [truth, setTruth] = useState(false), [auto, setAuto] = useState(false), autoRef = useRef(false);
  const timers = useRef(new Set<number>()), nextTimer = useRef<number | null>(null);
  const cancelAll = () => { timers.current.forEach(clearTimeout); timers.current.clear(); nextTimer.current = null; };
  const cancelNext = () => { if (nextTimer.current !== null) { clearTimeout(nextTimer.current); timers.current.delete(nextTimer.current); nextTimer.current = null; } };
  const later = (fn: () => void, delay: number) => {
    const id = window.setTimeout(() => { timers.current.delete(id); fn(); }, delay); timers.current.add(id); return id;
  };
  const showSlips = (value: SportsSlip[]) => { slipsRef.current = value; setSlips(value); };
  const showPhase = (value: Phase) => { phaseRef.current = value; setPhase(value); };
  const commit = (value: typeof session) => { sessionRef.current = value; setSession(value); };
  const newRound = (autoPick = false) => {
    const cfg = configRef.current;
    showSlips(createSportsSlips(cfg.tables, cfg.legs, autoPick, defaultRng)); showPhase('pick');
  };
  useEffect(() => { newRound(); return () => { autoRef.current = false; cancelAll(); }; }, []);
  const scheduleNext = () => {
    cancelNext();
    if (autoRef.current) nextTimer.current = later(() => { nextTimer.current = null; if (autoRef.current) mainRef.current(); }, PAUSE_MS);
  };
  const settle = () => {
    if (phaseRef.current !== 'playing') return;
    const round = settleSportsRound(slipsRef.current, configRef.current.bet);
    commit(appendSportsRound(sessionRef.current, round)); showPhase('done'); scheduleNext();
  };
  const play = () => {
    if (phaseRef.current !== 'pick' || !sportsReady(slipsRef.current)) return;
    cancelNext(); showPhase('playing');
    if (configRef.current.tables === 1) {
      const count = slipsRef.current[0].matches.length;
      for (let i = 0; i < count; i++) later(() => showSlips(revealSportsStep(slipsRef.current)), FIRST_MS + i * STEP_MS);
      later(settle, FIRST_MS + count * STEP_MS);
    } else later(() => { showSlips(revealSportsSlips(slipsRef.current)); settle(); }, MULTI_MS);
  };
  const main = (forceAuto = autoRef.current) => {
    if (phaseRef.current === 'playing') return;
    cancelNext();
    if (phaseRef.current === 'done') { newRound(forceAuto); if (forceAuto) play(); return; }
    if (forceAuto) showSlips(backSportsFavorites(slipsRef.current));
    play();
  };
  const mainRef = useRef(main); mainRef.current = main;
  const toggleAuto = () => {
    const value = !autoRef.current; autoRef.current = value; setAuto(value); cancelNext();
    if (value && phaseRef.current !== 'playing') mainRef.current(true);
  };
  const changeConfig = (key: keyof typeof config, value: number) => {
    if (phaseRef.current === 'playing') return;
    const next = { ...configRef.current, [key]: value }; configRef.current = next; setConfig(next);
    if (key !== 'bet') newRound();
  };
  const fast = () => {
    if (phaseRef.current === 'playing') return;
    cancelNext(); const cfg = configRef.current;
    const next = fastSports(sessionRef.current, cfg.tables, cfg.legs, cfg.bet, defaultRng);
    commit(next); showSlips(next.last!.slips); showPhase('done'); scheduleNext();
  };
  const reset = () => {
    autoRef.current = false; setAuto(false); cancelAll(); commit(newSportsSession()); newRound();
  };
  const pick = (index: number, outcome: Outcome) => {
    if (phaseRef.current === 'pick') showSlips(pickSportsOutcome(slipsRef.current, index, outcome));
  };
  const favorites = () => { if (phaseRef.current === 'pick') showSlips(backSportsFavorites(slipsRef.current)); };
  const busy = phase === 'playing', ready = sportsReady(slips), hasSlips = slips.length > 0;
  // A changed next stake must not rewrite a result that has already settled.
  const displayBet = phase === 'done' && session.last ? session.last.bet : config.bet;
  const views = slips.map(s => sportsSlipView(s, displayBet));
  const outcomes = [t.home, t.draw, t.away];
  const per100 = numbers.sports.presentation.value.return_per_100[String(config.legs) as keyof typeof numbers.sports.presentation.value.return_per_100];
  return <div class="sp" data-sports>
    <div class="sp-config">
      <div class="sp-control"><strong>{t.tables}</strong><SegmentedControl label={t.tablesLabel} values={SPORTS_TABLES} value={config.tables} format={n => locale === 'en' ? counted(n, 'bet') : `${n} 单`} onChange={value => changeConfig('tables', value)} disabled={busy} /></div>
      <div class="sp-control"><strong>{t.bet}</strong><SegmentedControl label={t.betLabel} values={SPORTS_BETS} value={config.bet} format={n => money(n, locale, false)} onChange={value => changeConfig('bet', value)} disabled={busy} /></div>
      <div class="sp-leg-control"><strong>{t.legs}</strong><SegmentedControl label={t.legsLabel} values={SPORTS_LEGS} value={config.legs} format={n => legLabel(n, locale)} onChange={value => changeConfig('legs', value)} disabled={busy} /><p>{sportsLegNote(config.legs, per100, locale)}</p></div>
    </div>
    <PnlHeader pnl={session.pnl} locale={locale} label={t.pnl} meta={sportsMeta(session, locale)}><LossConversion loss={lossAmount(session.pnl)} locale={locale} label={t.lost} /></PnlHeader>
    <div class="sp-table" aria-busy={busy}>
      {config.tables === 1 ? <>
        <div class="sp-matches">{views[0]?.matches.map((match, index) => <div class={`sp-match ${match.shown ? match.right ? 'right' : 'wrong' : ''}`} key={index}>
          <div class="sp-match-head"><strong>{sportsTeam(match.home, locale)} <span>vs</span> {sportsTeam(match.away, locale)}</strong><span class="sp-score">{match.score}</span></div>
          <div class="sp-outcomes" role="group" aria-label={`${sportsTeam(match.home, locale)} vs ${sportsTeam(match.away, locale)}`}>
            {match.options.map(option => <button type="button" key={option.outcome} data-outcome={option.outcome} aria-pressed={option.selected} disabled={phase !== 'pick'} class={`${option.selected ? 'selected' : ''} ${option.actual ? 'actual' : ''} ${match.shown && option.selected ? match.right ? 'right' : 'wrong' : ''}`} onClick={() => pick(index, option.outcome)}>
              <span>{option.actual ? '✓ ' : match.shown && option.selected ? '× ' : ''}{outcomes[option.outcome]}</span><strong>{option.odds.toFixed(2)}</strong><span class="sp-truth">{truth ? `${locale === 'en' ? 'True' : '真实'} ${option.truePercent}%` : ''}</span>
            </button>)}
          </div>
        </div>)}</div>
        <div class="sp-slip-controls"><span data-slip-text>{sportsSlipText(views[0], locale)}</span><div><button type="button" disabled={phase !== 'pick' || !hasSlips} onClick={favorites}>{t.favorites}</button><button type="button" aria-pressed={truth} onClick={() => setTruth(value => !value)}>{truth ? t.truthOn : t.truthOff}</button></div></div>
      </> : config.tables === 10 ? <div class="sp-tiles">{views.map((view, index) => {
        const text = sportsTileText(view, config.legs, busy, locale);
        return <div class={`sp-tile ${view.settled ? view.hit ? 'right' : 'wrong' : ''}`} key={index}><span>{text.top}</span><strong>{text.label}</strong></div>;
      })}</div> : <><HundredGrid items={views} label={t.tablesLabel} renderCell={view => <div class={`sp-cell ${view.settled ? view.hit ? 'right' : 'wrong' : ''}`} role="img" aria-label={sportsTileText(view, config.legs, busy, locale).label}>{view.settled ? view.hit ? '+' : '−' : ''}</div>} /><div class="sp-legend"><span>+ {t.won}</span><span>− {t.lostSlip}</span></div></>}
      <div class="sp-result" role="status" style={{ color: phase === 'done' && session.last ? pnlColor(session.last.delta) : 'var(--muted)' }}>{sportsResult(session, config.tables, phase, locale)}</div>
    </div>
    <div class="sp-actions"><button type="button" class="btn btn-primary" disabled={busy || !hasSlips || (phase === 'pick' && !ready)} onClick={() => main()}>{phase === 'done' ? t.next : t.kickoff}</button><button type="button" class="btn btn-outline" aria-pressed={auto} disabled={!hasSlips} onClick={toggleAuto}>{auto ? t.stop : t.auto}</button><button type="button" class="btn btn-soft" disabled={busy || !hasSlips} onClick={fast}>{t.fast}</button><button type="button" class="btn btn-ghost" onClick={reset}>{t.reset}</button></div>
    <PnlChart history={session.history} pnl={session.pnl} label={t.chart} note={t.note} />
  </div>;
}
