// src/components/widgets/DetectorLab.tsx
import './detector.css';
import { useEffect, useRef, useState } from 'preact/hooks';
import { defaultRng } from '../../engine/rng';
import { DetectorSession, E_THRESHOLD, R_THRESHOLD, SHIFT_AT, hiddenTruth, type Truth } from '../../engine/detector';
import type { Locale } from '../../i18n/site';

export type Mode = Truth | 'hidden';
export type Tab = 'test' | 'detect';
export const MODES: Mode[] = ['fair', 'rigged', 'shift', 'hidden'];

/** 页面从 i18n/source/Research-Detector.json 传进来的整句文案（编号见 ResearchDetector.astro） */
export interface LabCopy {
  modeLabel: string; modeGroup: string; tabGroup: string;
  modes: Record<Mode, string>; notes: Record<Mode, string>; tabs: Record<Tab, string>;
  statLabel: Record<Tab, string>; lineLegend: Record<Tab, string>; thrLegend: Record<Tab, string>;
  alarmLine: string; rounds: string; chart: string; change: string; naiveLegend: string; xUnit: string;
  start: string; notYet: Record<Tab, string>;
  bet: string; auto: string; stop: string; fast: string; reveal: string; newTable: string;
  truth: { fair: string; fairE: string; fairNoE: string; fairR: string; fairNoR: string; rigged: string; riggedWait: string; shift: string };
}

/** 带局数的句子按语言写模板；测试核对它们和 JSON 的碎片（071–073、077–078）拼起来一致 */
export const ALARM: Record<Locale, Record<Tab, (n: string) => string>> = {
  zh: { test: n => `第 ${n} 局报警：有充分证据表明这张桌子被动了手脚。`, detect: n => `第 ${n} 局报警：桌子从某一刻起变了。` },
  en: { test: n => `Alarm at round ${n}: enough evidence that this table has been rigged.`, detect: n => `Alarm at round ${n}: the table changed at some point.` },
};
export const NAIVE: Record<Locale, (n: string) => string> = {
  zh: n => ` 但“每局都看 p 值”在第 ${n} 局就喊作弊了。`,
  en: n => ` But “check the p-value every round” called it cheating at round ${n}.`,
};

const THR: Record<Tab, number> = { test: E_THRESHOLD, detect: R_THRESHOLD };
const TICK_MS = 60;
const PER_TICK = 3;
const count = (n: number) => n.toLocaleString('en-US');

/** 大号读数：≥ 1000 取整加千分位，否则 3 位有效数字；R 在第 0 局是 0 */
export function statText(v: number): string {
  if (v === 0) return '0';
  if (v >= 1000) return count(Math.round(v));
  return v >= 0.01 ? v.toPrecision(3) : '< 0.01';
}

/* 走势图坐标：与设计稿 renderVals() 一致 */
const X0 = 34, X1 = 306, Y0 = 10, Y1 = 180, BOT = -2, MAX_POINTS = 260;

export interface Props { locale: Locale; copy: LabCopy }

export default function DetectorLab({ locale, copy }: Props) {
  const [mode, setMode] = useState<Mode>('hidden');
  const [tab, setTab] = useState<Tab>('test');
  const [auto, setAuto] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [, setVersion] = useState(0);
  const session = useRef<DetectorSession | null>(null);
  const timer = useRef<number | undefined>(undefined);
  // “不告诉我”的桌子在浏览器里才抽，服务端渲染只画第 0 局
  if (!session.current) session.current = new DetectorSession(mode === 'hidden' ? hiddenTruth(defaultRng()) : mode);
  const s = session.current;
  const m = s.monitor;
  const tabRef = useRef(tab);
  tabRef.current = tab;

  const stopAuto = () => { window.clearInterval(timer.current); timer.current = undefined; setAuto(false); };
  useEffect(() => () => window.clearInterval(timer.current), []);

  const freshTable = (next: Mode) => {
    stopAuto();
    session.current = new DetectorSession(next === 'hidden' ? hiddenTruth(defaultRng()) : next);
    setRevealed(false);
    setVersion(v => v + 1);
  };

  /** 押 n 局；自动押时，当前标签页的检测一报警就停 */
  const step = (n: number) => {
    const cur = session.current!;
    for (let i = 0; i < n; i++) {
      const alarmOf = () => (tabRef.current === 'test' ? cur.monitor.alarmE : cur.monitor.alarmR);
      const before = alarmOf();
      cur.step(defaultRng);
      if (!before && alarmOf() && timer.current !== undefined) { stopAuto(); break; }
    }
    setVersion(v => v + 1);
  };

  const toggleAuto = () => {
    if (timer.current !== undefined) { stopAuto(); return; }
    setAuto(true);
    timer.current = window.setInterval(() => step(PER_TICK), TICK_MS);
  };

  const isTest = tab === 'test';
  const hist = isTest ? s.logE : s.logR;
  const thr = THR[tab];
  const lthr = Math.log10(thr);
  const value = isTest ? m.e : m.r;
  const alarm = isTest ? m.alarmE : m.alarmR;

  let top = lthr + 0.6;
  for (const h of hist) if (h > top - 0.2) top = h + 0.2;
  const xmax = Math.max(200, m.t);
  const px = (t: number) => X0 + (t / xmax) * (X1 - X0);
  const py = (v: number) => Y0 + ((top - Math.max(BOT, Math.min(top, v))) / (top - BOT)) * (Y1 - Y0);
  const stride = Math.max(1, Math.ceil(hist.length / MAX_POINTS));
  const pts: string[] = [];
  for (let j = 0; j < hist.length; j += stride) pts.push(`${px(j).toFixed(1)} ${py(hist[j]).toFixed(1)}`);
  if ((hist.length - 1) % stride !== 0) pts.push(`${px(hist.length - 1).toFixed(1)} ${py(hist[hist.length - 1]).toFixed(1)}`);
  const path = m.t > 0 ? `M${pts.join(' L')}` : '';
  const showChange = revealed && s.truth === 'shift';

  let alert = alarm ? ALARM[locale][tab](count(alarm)) : m.t === 0 ? copy.start : copy.notYet[tab];
  if (isTest && m.alarmNaive && !alarm) alert += NAIVE[locale](count(m.alarmNaive));

  const join = (a: string, b: string) => (b ? (locale === 'en' ? `${a} ${b}` : a + b) : a);
  let truth = '';
  if (revealed) {
    const T = copy.truth;
    if (s.truth === 'fair') truth = join(T.fair, isTest ? (m.alarmE ? T.fairE : T.fairNoE) : (m.alarmR ? T.fairR : T.fairNoR));
    else if (s.truth === 'rigged') truth = join(T.rigged, alarm ? '' : T.riggedWait);
    else truth = T.shift;
  }

  const rounds = copy.rounds
    .replace('{{rounds}}', count(m.t))
    .replace('{{winRate}}', m.t ? `${((m.wins / m.t) * 100).toFixed(1)}%` : '—');
  const thrText = count(thr);

  return (
    <div class="rd-lab">
      <div class="rd-mode">
        <span class="rd-mode-label">{copy.modeLabel}</span>
        <div class="rd-mode-group" role="group" aria-label={copy.modeGroup}>
          {MODES.map(k => (
            <button type="button" class={`rd-mode-btn${k === mode ? ' is-on' : ''}`} aria-pressed={k === mode}
              onClick={() => { setMode(k); freshTable(k); }}>{copy.modes[k]}</button>
          ))}
        </div>
        <span class="rd-mode-note">{copy.notes[mode]}</span>
      </div>

      <div class="rd-tabs" role="group" aria-label={copy.tabGroup}>
        {(['test', 'detect'] as Tab[]).map(k => (
          <button type="button" class={`rd-tab${k === tab ? ' is-on' : ''}`} aria-pressed={k === tab} onClick={() => setTab(k)}>{copy.tabs[k]}</button>
        ))}
      </div>

      <div class="rd-stats">
        <span class="rd-stat-label">{copy.statLabel[tab]}</span>
        <div class="rd-stat-row">
          <span class={`rd-stat-value${alarm ? ' is-alarm' : ''}`}>{statText(value)}</span>
          <span class="rd-stat-thr">{copy.alarmLine.replace('{{thrText}}', thrText)}</span>
        </div>
        <span class="rd-rounds">{rounds}</span>
      </div>

      <div class="rd-chart">
        <svg viewBox="0 0 310 200" role="img" aria-label={copy.chart}>
          <line x1={X0} y1={py(0).toFixed(1)} x2={X1} y2={py(0).toFixed(1)} stroke="var(--soft-on-dark)" stroke-width="1" />
          <line x1={X0} y1={py(lthr).toFixed(1)} x2={X1} y2={py(lthr).toFixed(1)} stroke="var(--loss)" stroke-width="1.4" stroke-dasharray="5 4" />
          {showChange && <g>
            <line x1={px(SHIFT_AT).toFixed(1)} y1="8" x2={px(SHIFT_AT).toFixed(1)} y2="182" stroke="var(--ink)" stroke-width="1" stroke-dasharray="2 3" stroke-opacity="0.8" />
            <text x={px(SHIFT_AT).toFixed(1)} y="196" text-anchor="middle" font-size="10" fill="var(--ink)" fill-opacity="0.8">{copy.change}</text>
          </g>}
          {path && <path class="rd-path" d={path} fill="none" stroke="var(--ink)" stroke-width="2.2" stroke-linejoin="round" />}
          {alarm > 0 && <circle class="rd-alarm-dot" cx={px(alarm).toFixed(1)} cy={py(hist[alarm]).toFixed(1)} r="6" fill="var(--loss)" />}
          {isTest && m.alarmNaive > 0 && <circle class="rd-naive-dot" cx={px(m.alarmNaive).toFixed(1)} cy={py(hist[m.alarmNaive]).toFixed(1)} r="5" fill="var(--page)" stroke="var(--you)" stroke-width="2" />}
          <g font-family="var(--font-mono)" font-size="10" fill="var(--muted)" text-anchor="end">
            <text x="30" y={(py(lthr) + 4).toFixed(1)} fill="var(--loss)">{thrText}</text>
            <text x="30" y={(py(0) + 4).toFixed(1)}>1</text>
          </g>
          <text x={X0} y="196" font-family="var(--font-mono)" font-size="10" fill="var(--muted)">0</text>
          <text class="rd-xmax" x={X1} y="196" text-anchor="end" font-family="var(--font-mono)" font-size="10" fill="var(--muted)">{count(xmax)}{copy.xUnit}</text>
        </svg>

        <div class="rd-legend">
          <span class="rd-legend-item">
            <svg width="22" height="10" aria-hidden="true"><line x1="0" y1="5" x2="22" y2="5" stroke="var(--ink)" stroke-width="2.2" /></svg>
            <span>{copy.lineLegend[tab]}</span>
          </span>
          <span class="rd-legend-item">
            <svg width="22" height="10" aria-hidden="true"><line x1="0" y1="5" x2="22" y2="5" stroke="var(--loss)" stroke-width="1.4" stroke-dasharray="5 4" /></svg>
            <span>{copy.thrLegend[tab]}</span>
          </span>
          {isTest && <span class="rd-legend-item">
            <svg width="22" height="10" aria-hidden="true"><circle cx="11" cy="5" r="4" fill="var(--page)" stroke="var(--you)" stroke-width="2" /></svg>
            <span>{copy.naiveLegend}</span>
          </span>}
        </div>

        <div class={`rd-alert${alarm ? ' is-alarm' : ''}`} aria-live="polite">{alert}</div>
      </div>

      <div class="rd-actions">
        <button type="button" class="rd-btn-primary" onClick={() => step(1)}>{copy.bet}</button>
        <button type="button" class={`rd-btn-outline${auto ? ' is-on' : ''}`} aria-pressed={auto} onClick={toggleAuto}>{auto ? copy.stop : copy.auto}</button>
        <button type="button" class="rd-btn-soft" onClick={() => step(100)}>{copy.fast}</button>
        <button type="button" class="rd-btn-soft" onClick={() => setRevealed(true)}>{copy.reveal}</button>
      </div>
      <button type="button" class="rd-btn-new" onClick={() => freshTable(mode)}>{copy.newTable}</button>
      {revealed && <p class="rd-truth" aria-live="polite">{truth}</p>}
    </div>
  );
}
