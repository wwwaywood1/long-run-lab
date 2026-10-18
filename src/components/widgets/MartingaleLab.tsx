import './martingale.css';
import { useMemo, useState } from 'preact/hooks';
import { defaultRng } from '../../engine/rng';
import { EDGE, MG, STRATEGIES, simulate, storySession, summarize, type Session, type Strategy, type Summary } from '../../engine/martingale';
import { money, type Locale } from '../../i18n/site';

/** 横轴标签。倍投按“轮”，其他按“局”。默认画面（倍投第 0 / 83 轮）必须与 Ch4-Martingale.019 / 020 一字不差（测试核对）。 */
export const AXIS: Record<Locale, (unit: Session['unit'], n: number) => string> = {
  zh: (unit, n) => `第 ${n.toLocaleString('en-US')} ${unit === 'round' ? '轮' : '局'}`,
  en: (unit, n) => `${unit === 'round' ? 'Round' : 'Spin'} ${n.toLocaleString('en-US')}`,
};

/** NEW COPY（Claude 2026-10-17）：每种方法的规则、单次结果、一万次汇总、按钮 */
export const LAB_COPY: Record<Locale, {
  rules: Record<Strategy, string>;
  again: string;
  many: string;
  result: (s: Session, locale: Locale) => string;
  chart: (s: Session, locale: Locale) => string;
  summary: (r: Summary, locale: Locale) => string;
}> = {
  zh: {
    rules: {
      flat: '每局押红 10 元，押 100 局。',
      double: '每轮从 10 元押起，输了加倍，赢一次就收手；连输 7 次撞上限红，这一轮亏 1,270 元。最多 100 轮，钱不够倍投一整轮就停。',
      stops: '每局押红 10 元，赢到 +100 元或输到 −300 元就收手。',
      pattern: '连开 3 次同色之后，押另一种颜色 10 元；其他时候不押。看 200 局。',
    },
    again: '再来一次',
    many: '跑一万次',
    result: (s, l) => `这一次：下了 ${s.bets.toLocaleString('en-US')} 注，一共押了 ${money(s.wagered, l, false)}，最后 ${money(s.net, l)}。`,
    chart: (s, l) => `资金曲线，从${AXIS.zh(s.unit, 0)}到${AXIS.zh(s.unit, s.path.length - 1)}，最后 ${money(s.net, l)}`,
    summary: (r, l) => `一万次里，${(r.ahead * 100).toFixed(1)}% 最后赚钱。平均每次押 ${money(r.meanWagered, l, false)}，亏 ${money(-r.meanNet, l, false)}：每押 100 元平均亏 ${(r.lossPerUnit * 100).toFixed(2)} 元，理论值 ${(EDGE * 100).toFixed(2)} 元。`,
  },
  en: {
    rules: {
      flat: 'Bet $10 on red every spin, for 100 spins.',
      double: 'Each round starts at $10 and doubles after a loss until one win; 7 losses in a row hit the table limit and cost $1,270. Up to 100 rounds, stopping once you can no longer fund a full round.',
      stops: 'Bet $10 on red every spin; quit at +$100 or −$300.',
      pattern: 'After 3 of the same color in a row, bet $10 on the other color; otherwise sit out. Watch 200 spins.',
    },
    again: 'Play again',
    many: 'Run 10,000 times',
    result: (s, l) => `This time: ${s.bets.toLocaleString('en-US')} bets, ${money(s.wagered, l, false)} wagered in total, ending ${money(s.net, l)}.`,
    chart: (s, l) => `Bankroll path from ${AXIS.en(s.unit, 0)} to ${AXIS.en(s.unit, s.path.length - 1)}, ending ${money(s.net, l)}`,
    summary: (r, l) => `Of 10,000 tries, ${(r.ahead * 100).toFixed(1)}% ended ahead. On average each try wagered ${money(r.meanWagered, l, false)} and lost ${money(-r.meanNet, l, false)}: $${(r.lossPerUnit * 100).toFixed(2)} lost per $100 wagered, against a theoretical $${(EDGE * 100).toFixed(2)}.`,
  },
};

interface Props {
  locale: Locale;
  labels: {
    group: string;
    methods: Record<Strategy, string>;
    params: string;
    /** 默认画面的图说明、本金线、峰值标签、默认结论（Ch4-Martingale.016 / 017 / 018 / 021） */
    storyChart: string;
    bankroll: string;
    storyPeak: string;
    storyCaption: string;
  };
}

/** 图上的带符号整数：+820、−1,270（真正的减号） */
const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(Math.round(n)).toLocaleString('en-US')}`;

/** 只做坐标换算。资金数字全部来自 engine/martingale。 */
function chartOf(s: Session) {
  const left = 8, right = 296, top = 18, bottom = 150;
  const n = s.path.length - 1;
  const step = Math.max(1, Math.ceil(n / 300)); // 点太多时抽稀，保留最后一点
  const idx = Array.from({ length: Math.floor(n / step) + 1 }, (_, i) => i * step);
  if (idx[idx.length - 1] !== n) idx.push(n);
  const lo = Math.min(...s.path, MG.bankroll), hi = Math.max(...s.path, MG.bankroll);
  const pad = Math.max(20, (hi - lo) * 0.08);
  const y = (v: number) => top + ((hi + pad - v) / (hi - lo + 2 * pad)) * (bottom - top);
  const x = (i: number) => left + (n ? i / n : 0) * (right - left);
  const pts = idx.map(i => `${x(i).toFixed(1)} ${y(s.path[i]).toFixed(1)}`);
  return { x, y, n, path: `M${pts.join(' L')}`, base: y(MG.bankroll) };
}

export default function MartingaleLab({ locale, labels }: Props) {
  const copy = LAB_COPY[locale];
  const [strategy, setStrategy] = useState<Strategy>('double');
  const [session, setSession] = useState<Session>(storySession);
  const [story, setStory] = useState(true);
  const [summary, setSummary] = useState<Summary | null>(null);
  const c = useMemo(() => chartOf(session), [session]);

  const run = (s: Strategy) => {
    setStrategy(s);
    setSession(simulate(s, defaultRng));
    setStory(false);
    setSummary(null);
  };

  const n = c.n;
  const last = session.path[n];
  // 默认画面：峰值和最后一轮的跌幅单独标出（设计稿）
  const peak = story ? n - 1 : -1;
  const drop = story ? session.path[n] - session.path[n - 1] : 0;
  const endY = c.y(last);

  return (
    <div class="p4m-lab">
      <div role="group" aria-label={labels.group} class="p4m-seg">
        {STRATEGIES.map(s => (
          <button type="button" aria-pressed={s === strategy} onClick={() => run(s)}>{labels.methods[s]}</button>
        ))}
      </div>
      <p class="p4m-params">{labels.params}</p>
      <p class="p4m-rule-text">{copy.rules[strategy]}</p>

      <svg viewBox="0 0 318 176" class="ch-figure" role="img" aria-label={story ? labels.storyChart : copy.chart(session, locale)}>
        <line x1="8" y1={c.base} x2="310" y2={c.base} stroke="var(--muted)" stroke-width="1" stroke-dasharray="4 4" />
        <text x="10" y={c.base + 14} font-family="var(--font-mono)" font-size="11" fill="var(--muted)">{labels.bankroll}</text>
        {story ? (
          <>
            <path d={`M${session.path.slice(0, n).map((v, i) => `${c.x(i).toFixed(1)} ${c.y(v).toFixed(1)}`).join(' L')}`} fill="none" stroke="var(--you)" stroke-width="2.4" stroke-linejoin="round" />
            <path d={`M${c.x(n - 1).toFixed(1)} ${c.y(session.path[n - 1]).toFixed(1)} L${c.x(n).toFixed(1)} ${endY.toFixed(1)}`} fill="none" stroke="var(--loss)" stroke-width="3" />
            <circle cx={c.x(n)} cy={endY} r="10" fill="var(--highlight)" />
            <circle cx={c.x(n)} cy={endY} r="4.5" fill="var(--loss)" />
            <text x={c.x(peak) - 8} y={c.y(session.path[peak]) - 8} text-anchor="end" font-family="var(--font-mono)" font-size="11" fill="var(--you)">{labels.storyPeak}</text>
            <text x={c.x(n) - 14} y={endY + 4} text-anchor="end" font-family="var(--font-mono)" font-size="12" font-weight="600" fill="var(--loss)">{signed(drop)}</text>
          </>
        ) : (
          <>
            <path d={c.path} fill="none" stroke="var(--you)" stroke-width="2" stroke-linejoin="round" />
            <circle cx={c.x(n)} cy={endY} r="4.5" fill={last < MG.bankroll ? 'var(--loss)' : 'var(--you)'} />
            <text x={c.x(n) - 8} y={endY < 40 ? endY + 18 : endY - 10} text-anchor="end" font-family="var(--font-mono)" font-size="12" font-weight="600" fill={last < MG.bankroll ? 'var(--loss)' : 'var(--you)'}>{signed(last - MG.bankroll)}</text>
          </>
        )}
        <text x="8" y="170" font-family="var(--font-mono)" font-size="11" fill="var(--muted)">{AXIS[locale](session.unit, 0)}</text>
        <text x="310" y="170" text-anchor="end" font-family="var(--font-mono)" font-size="11" fill="var(--muted)">{AXIS[locale](session.unit, n)}</text>
      </svg>

      <p class="ch-body" aria-live="polite">{story ? labels.storyCaption : copy.result(session, locale)}</p>

      <div class="p4m-actions">
        <button type="button" class="p4m-btn" onClick={() => run(strategy)}>{copy.again}</button>
        <button type="button" class="p4m-btn is-solid" onClick={() => setSummary(summarize(strategy, 10000, defaultRng))}>{copy.many}</button>
      </div>
      {summary && <p class="p4m-summary" role="status">{copy.summary(summary, locale)}</p>}
    </div>
  );
}
