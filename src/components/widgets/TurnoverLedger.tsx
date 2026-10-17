// src/components/widgets/TurnoverLedger.tsx
import { useState } from 'preact/hooks';
import { turnoverLedger } from '../../engine/ledger';
import { intCount } from '../../i18n/format';
import type { Locale } from '../../i18n/site';

/** 滑块旁的次数：JSON 里的 Part4-RealWorld.011 只写了 10 次，这里按次数生成；n = 10 时必须与它一字不差（测试核对） */
export const TIMES: Record<Locale, (n: number) => string> = {
  zh: n => `${n} 次`,
  en: n => (n === 1 ? '1 time' : `${n} times`),
};

export const TURN_RANGE = { min: 1, max: 30, initial: 10 } as const;

interface Props {
  locale: Locale;
  /** 换成筹码的现金（任务设定固定 100，由页面传入） */
  cash: number;
  /** 押庄的庄家优势，来自 data/numbers.json 的 baccarat.eight_deck_published.value.edge.B */
  edge: number;
  labels: {
    times: string;
    cash: string;
    totalBet: string;
    houseWin: string;
    divTotal: string;
    edge: string;
    divCash: string;
    hold: string;
  };
}

/** 第四部分“同一笔钱，两种算法”。三条账目和两张卡片全部由 engine/ledger 计算，组件只管滑块和显示。 */
export default function TurnoverLedger({ locale, cash, edge, labels }: Props) {
  const [times, setTimes] = useState<number>(TURN_RANGE.initial);
  const result = turnoverLedger(cash, times, edge);
  const timesText = TIMES[locale](times);

  return (
    <div class="p4r-calc">
      <div class="p4r-slider">
        <div class="p4r-slider-head">
          <label for="p4r-turn">{labels.times}</label>
          <span class="p4r-slider-value">{timesText}</span>
        </div>
        <input
          id="p4r-turn"
          type="range"
          min={TURN_RANGE.min}
          max={TURN_RANGE.max}
          step={1}
          value={times}
          aria-valuetext={timesText}
          onInput={e => setTimes(Number((e.target as HTMLInputElement).value))}
        />
      </div>

      <div class="p4r-out" aria-live="polite">
        <div class="p4r-ledger">
          <div class="p4r-row">
            <span>{labels.cash}</span>
            <span class="p4r-row-val">{intCount(result.cash)}</span>
          </div>
          <div class="p4r-row">
            <span>{labels.totalBet}</span>
            <span class="p4r-row-val">{intCount(result.totalBet)}</span>
          </div>
          <div class="p4r-row is-strong">
            <span>{labels.houseWin}</span>
            <span class="p4r-row-val">{result.houseWin.toFixed(1)}</span>
          </div>
        </div>

        <div class="p4r-cards">
          <div class="p4r-card">
            <span class="p4r-card-label">{labels.divTotal}</span>
            <span class="p4r-card-value">{(result.edge * 100).toFixed(2)}%</span>
            <span class="p4r-card-label">{labels.edge}</span>
          </div>
          <div class="p4r-card is-dark">
            <span class="p4r-card-label">{labels.divCash}</span>
            <span class="p4r-card-value">{(result.holdOnCash * 100).toFixed(1)}%</span>
            <span class="p4r-card-label">{labels.hold}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
