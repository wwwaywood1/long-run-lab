// src/components/widgets/PayoutBreakdown.tsx
import { useState } from 'preact/hooks';
import { payoutBreakdown, type BetKey } from '../../engine/roulette';
import type { Locale } from '../../i18n/site';

/** 倍数：最多 2 位小数，去掉末尾的 0（37、6.6、2.17、1.11） */
export const multiplierValue = (n: number) => String(Number(n.toFixed(2)));

/** 倍数的写法：中文“37 倍”，英文“37×” */
export const MULTIPLIER: Record<Locale, (x: string) => string> = {
  zh: x => `${x} 倍`,
  en: x => `${x}×`,
};

/** 优势：保留 2 位小数加 % */
export const edgeText = (edge: number) => `${(edge * 100).toFixed(2)}%`;

/** NEW COPY：下面那句话的模板。选单号时去掉标签后必须与 Part2-Roulette.027 的中英文一字不差（测试核对） */
export const SHORTFALL: Record<Locale, (x: string, pct: string) => string> = {
  zh: (x, pct) => `黑色那一截，就是庄家少付的 ${x} 倍。摊到每一注，正好是 <strong>${pct}</strong>。`,
  en: (x, pct) => `The black slice is the ${x}× the house does not pay back. Spread over every bet, it comes to exactly <strong>${pct}</strong>.`,
};

interface Props {
  locale: Locale;
  labels: {
    group: string;
    straight: string;
    five: string;
    dozen: string;
    red: string;
    fair: string;
    actual: string;
  };
}

/** 第二部分“赔率拆解器”。公平赔率、实际赔率、少付比例、优势全部来自 engine/roulette。 */
export default function PayoutBreakdown({ locale, labels }: Props) {
  const [bet, setBet] = useState<BetKey>('straight');
  const result = payoutBreakdown(bet);
  const options: { key: BetKey; label: string }[] = [
    { key: 'straight', label: labels.straight },
    { key: 'five', label: labels.five },
    { key: 'dozen', label: labels.dozen },
    { key: 'red', label: labels.red },
  ];

  return (
    <div class="p2r-breakdown">
      <div role="group" aria-label={labels.group} class="p2r-seg">
        {options.map(o => (
          <button type="button" aria-pressed={o.key === bet} onClick={() => setBet(o.key)}>{o.label}</button>
        ))}
      </div>

      <div class="p2r-out" aria-live="polite">
        <div class="p2r-bars">
          <div class="p2r-bar-block">
            <div class="p2r-bar-head">
              <span>{labels.fair}</span>
              <span class="p2r-bar-value">{MULTIPLIER[locale](multiplierValue(result.fair))}</span>
            </div>
            <div class="p2r-bar-fair" />
          </div>
          <div class="p2r-bar-block">
            <div class="p2r-bar-head">
              <span>{labels.actual}</span>
              <span class="p2r-bar-value">{MULTIPLIER[locale](multiplierValue(result.pays))}</span>
            </div>
            <div class="p2r-bar-actual">
              <span class="p2r-bar-paid" style={{ width: `${result.paidShare * 100}%` }} />
              <span class="p2r-bar-keep" />
            </div>
          </div>
        </div>

        <p
          class="ch-body"
          dangerouslySetInnerHTML={{ __html: SHORTFALL[locale](multiplierValue(result.shortfall), edgeText(result.edge)) }}
        />
      </div>
    </div>
  );
}
