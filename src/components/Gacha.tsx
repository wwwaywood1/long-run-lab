import { useEffect, useRef, useState } from 'preact/hooks';
import {
  drawGacha, FIVE_STAR_PITY, GACHA_PLAYERS, gachaPlayerView, newPlayer, simulateGachaGroup, TEN_PULL,
  type DrawMode, type GachaGroup, type GachaRun, type Player, type PullKind,
} from '../engine/gacha';
import { defaultRng } from '../engine/rng';
import { counted } from '../i18n/copy';
import { GACHA_COPY, gachaBanner, gachaMeta, groupRange, groupResult, pityText } from '../i18n/gacha';
import { money, type Locale } from '../i18n/site';
import SegmentedControl from './shared/SegmentedControl';
import PnlHeader from './shared/PnlHeader';
import LossConversion from './shared/LossConversion';
import HundredGrid from './shared/HundredGrid';
import './Gacha.css';

const FLIP_START_MS = 60, FLIP_GAP_MS = 70, FLIP_MS = 320, GROUP_MS = 500;
export interface Props { locale: Locale; defaultPlayers?: 1 | 10 | 100 }
export default function Gacha({ locale, defaultPlayers = 1 }: Props) {
  const t = GACHA_COPY[locale];
  const [players, setPlayers] = useState<number>(defaultPlayers), playersRef = useRef(players);
  const [player, setPlayer] = useState(newPlayer), playerRef = useRef(player);
  const [run, setRun] = useState<GachaRun | null>(null), [revealed, setRevealed] = useState(0);
  const [group, setGroup] = useState<GachaGroup | null>(null);
  const [busy, setBusy] = useState(false), busyRef = useRef(false), [sequence, setSequence] = useState(0);
  const timers = useRef(new Set<number>());
  const cancel = () => { timers.current.forEach(clearTimeout); timers.current.clear(); };
  useEffect(() => {
    if (defaultPlayers > 1) runGroup(defaultPlayers as 10 | 100);
    return cancel;
  }, []);
  const later = (fn: () => void, delay: number) => {
    const id = window.setTimeout(() => { timers.current.delete(id); fn(); }, delay);
    timers.current.add(id);
  };
  const markBusy = (value: boolean) => { busyRef.current = value; setBusy(value); };
  const showPlayer = (value: Player) => { playerRef.current = value; setPlayer(value); };
  function runGroup(count: 10 | 100) {
    if (busyRef.current) return;
    markBusy(true); setGroup(null);
    const next = simulateGachaGroup(count, defaultRng);
    later(() => { setGroup(next); markBusy(false); }, GROUP_MS);
  }
  const changePlayers = (count: number) => {
    if (busyRef.current) return;
    playersRef.current = count; setPlayers(count); setGroup(null);
    if (count > 1) runGroup(count as 10 | 100);
  };
  const draw = (mode: DrawMode) => {
    if (busyRef.current) return;
    const next = drawGacha(playerRef.current, mode, defaultRng);
    setSequence(n => n + 1); setRun(next); setRevealed(0); markBusy(true); showPlayer(next.beforeDisplay);
    next.frames.forEach((frame, index) => later(() => { setRevealed(index + 1); showPlayer(frame.player); }, FLIP_START_MS + index * FLIP_GAP_MS));
    later(() => markBusy(false), FLIP_START_MS + (next.frames.length - 1) * FLIP_GAP_MS + FLIP_MS);
  };
  const reset = () => {
    cancel(); markBusy(false); showPlayer(newPlayer()); setRun(null); setRevealed(0); setGroup(null);
  };
  const view = gachaPlayerView(player), banner = gachaBanner(!busy ? run : null, player, locale);
  const cardLabels: Record<PullKind, string> = { F: t.featured, O: t.off, '4': t.four, '3': t.three };
  const stars: Record<PullKind, string> = { F: '★★★★★', O: '★★★★★', '4': '★★★★', '3': '★★★' };
  const playerName = (index: number) => locale === 'en' ? `Player ${index + 1}` : `玩家 ${index + 1}`;
  const bandNumber = { low: '1', middle: '2', high: '3' };
  return <div class="gc" data-gacha>
    <div class="gc-controls"><strong>{t.players}</strong><SegmentedControl label={t.playersLabel} values={GACHA_PLAYERS} value={players} format={n => n === 1 ? t.me : locale === 'en' ? counted(n, 'player') : `${n} 人`} onChange={changePlayers} disabled={busy} /></div>
    {players === 1 ? <div class="gc-one">
      <PnlHeader pnl={view.net} locale={locale} currency="CNY" label={t.spent} meta={gachaMeta(player, locale)}>
        <LossConversion loss={view.spent} locale={locale} currency="CNY" label="{{itemText}}" />
      </PnlHeader>
      <div class="gc-table" aria-busy={busy}>
        <div class="gc-pity">
          <div><span>{t.pity}</span><strong data-pity>{pityText(player, locale)}</strong></div>
          <div class="gc-pity-track" role="progressbar" aria-label={t.pity} aria-valuemin={0} aria-valuemax={FIVE_STAR_PITY} aria-valuenow={player.since5} aria-valuetext={pityText(player, locale)}><i class={view.softPity ? 'soft' : ''} style={{ width: `${view.pityPercent}%` }} /></div>
          <span class={view.guaranteed ? 'gc-guaranteed' : ''} data-guarantee>{view.guaranteed ? t.guaranteed : t.fifty}</span>
        </div>
        <div class="gc-cards" role="group" aria-label={t.ten}>
          {Array.from({ length: TEN_PULL }, (_, index) => {
            const frame = run && index < revealed ? run.frames[index] : null;
            return <div key={`${sequence}-${index}`} class={`gc-card ${frame ? `gc-flipped kind-${frame.kind}` : 'empty'}`} data-card={index} role={frame ? 'img' : undefined} aria-label={frame ? `${stars[frame.kind]} · ${cardLabels[frame.kind]}` : undefined} aria-hidden={!frame || undefined}>
              {frame && <><span aria-hidden="true">{stars[frame.kind]}</span><strong aria-hidden="true">{cardLabels[frame.kind]}</strong></>}
            </div>;
          })}
        </div>
        <div class={`gc-banner ${banner.kind}`} role="status"><strong>{banner.title}</strong><span>{banner.sub}</span></div>
      </div>
      <div class="gc-actions">
        <button type="button" class="btn btn-outline" onClick={() => draw(1)} disabled={busy}>{t.single}</button>
        <button type="button" class="btn btn-primary" onClick={() => draw(10)} disabled={busy}>{t.ten}</button>
        <button type="button" class="btn btn-soft" onClick={() => draw('until')} disabled={busy}>{t.until}</button>
        <button type="button" class="btn btn-ghost" onClick={reset}>{t.reset}</button>
      </div>
      <p class="gc-price-note">{t.priceNote}</p>
    </div> : <div class="gc-many">
      <div class="gc-average" aria-live="polite" aria-atomic="true"><span>{t.average}</span><strong style={{ color: group ? 'var(--loss)' : 'var(--ink)' }}>{group ? money(group.average, locale, false, 'CNY') : '—'}</strong><span data-group-range>{groupRange(group, locale)}</span></div>
      <div class="gc-group-panel" aria-busy={busy}>
        {players === 10 ? <div class="gc-bars">{group?.players.map((entry, index) => <div class="gc-bar-row" key={index}>
          <span>{playerName(index)}</span><div class="gc-bar-track" aria-hidden="true"><i class={entry.band} style={{ width: `${entry.width}%` }} /></div><strong>{money(entry.cost, locale, false, 'CNY')}</strong>
        </div>)}</div> : <><HundredGrid items={group?.players ?? []} label={t.playersLabel} className="gc-cost-grid" renderCell={(entry, index) => <div class={`gc-cost-cell ${entry.band}`} role="img" aria-label={`${playerName(index)} · ${money(entry.cost, locale, false, 'CNY')}`} title={`${playerName(index)} · ${money(entry.cost, locale, false, 'CNY')}`}><span aria-hidden="true">{bandNumber[entry.band]}</span></div>} />
          <div class="gc-cost-legend">{(['low', 'middle', 'high'] as const).map(band => <span><i class={band}>{bandNumber[band]}</i>{t[band]}</span>)}</div></>}
        <div class="gc-group-result" role="status">{groupResult(group, locale)}</div>
      </div>
      <div class="gc-actions"><button type="button" class="btn btn-primary" disabled={busy} onClick={() => runGroup(playersRef.current as 10 | 100)}>{t.rerun}</button><button type="button" class="btn btn-ghost" onClick={reset}>{t.clear}</button></div>
    </div>}
  </div>;
}
