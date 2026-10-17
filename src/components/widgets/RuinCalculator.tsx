import './widgets.css';
import { useState } from 'preact/hooks';
import { CHIPS, ruin, snapToBet } from '../../engine/ruin';
import { formatChance, roughCount } from '../../i18n/format';
import { money, type Locale } from '../../i18n/site';

/** 文案由页面从 i18n/source/Ch3-Ruin.json 传进来；只有带数字的句子在这里按语言写模板（测试核对它和 JSON 一致） */
export const ENDS_AFTER: Record<Locale, (rounds: string) => string> = {
  zh: rounds => `平均约 ${rounds} 局后结束。`,
  en: rounds => `It ends after about ${rounds} rounds on average.`,
};

export const RUIN_LIMITS = { bankroll: [10, 1000], goal: [20, 2000] } as const;

interface Props {
  locale: Locale;
  labels: { bankroll: string; goal: string; bet: string; win: string; ruin: string };
}

/** 第 3 章“破产计算器”。概率全部来自 engine/ruin（精确公式），组件只管滑块和显示。 */
export default function RuinCalculator({ locale, labels }: Props) {
  const [betIndex, setBetIndex] = useState(0);
  const bet = CHIPS[betIndex];
  const [bankroll, setBankroll] = useState(100);
  const [goal, setGoal] = useState(200);

  const fit = (b: number, bank: number, g: number) => {
    const nb = snapToBet(bank, b, RUIN_LIMITS.bankroll[0], RUIN_LIMITS.bankroll[1]);
    const ng = snapToBet(Math.max(g, nb + b), b, nb + b, RUIN_LIMITS.goal[1]);
    setBankroll(nb);
    setGoal(ng);
  };

  const result = ruin(bankroll, goal, bet);
  const fmt = (n: number) => money(n, locale, false);
  const id = (s: string) => `ruin-${s}`;

  return (
    <div class="ch-panel ruin-calc">
      <div class="ruin-field">
        <div class="ruin-row"><label for={id('bank')}>{labels.bankroll}</label><span class="ruin-value">{fmt(bankroll)}</span></div>
        <input id={id('bank')} type="range" min={snapToBet(RUIN_LIMITS.bankroll[0], bet, bet, 1000)} max={RUIN_LIMITS.bankroll[1]} step={bet} value={bankroll}
          aria-valuetext={fmt(bankroll)} onInput={e => fit(bet, Number((e.target as HTMLInputElement).value), goal)} />
      </div>
      <div class="ruin-field">
        <div class="ruin-row"><label for={id('goal')}>{labels.goal}</label><span class="ruin-value">{fmt(goal)}</span></div>
        <input id={id('goal')} type="range" min={bankroll + bet} max={RUIN_LIMITS.goal[1]} step={bet} value={goal}
          aria-valuetext={fmt(goal)} onInput={e => fit(bet, bankroll, Number((e.target as HTMLInputElement).value))} />
      </div>
      <div class="ruin-field">
        <div class="ruin-row"><label for={id('bet')}>{labels.bet}</label><span class="ruin-value">{fmt(bet)}</span></div>
        <input id={id('bet')} type="range" min={0} max={CHIPS.length - 1} step={1} value={betIndex}
          aria-valuetext={fmt(bet)} onInput={e => { const k = Number((e.target as HTMLInputElement).value); setBetIndex(k); fit(CHIPS[k], bankroll, goal); }} />
      </div>
      <div class="ruin-rule" />
      <div aria-live="polite" class="ruin-out">
        <div class="ruin-row"><span>{labels.win}</span><strong class="ruin-big you">{formatChance(result.pWin)}</strong></div>
        <div class="ruin-row"><span>{labels.ruin}</span><strong class="ruin-big loss">{formatChance(result.pRuin)}</strong></div>
        <span class="ruin-note">{ENDS_AFTER[locale](roughCount(result.expectedRounds))}</span>
      </div>
    </div>
  );
}
