// src/components/widgets/SequenceDetector.tsx
import { useState } from 'preact/hooks';
import { assessSequence, type Verdict } from '../../engine/sequence';
import type { Locale } from '../../i18n/site';

/** NEW COPY：JSON 里没有的界面文字（进度朗读、撤销/重来、平均换色、三种结论、判定规则小字） */
interface Copy {
  progress: (k: number) => string;
  undo: string;
  reset: string;
  average: (x: string) => string;
  verdict: Record<Verdict, string>;
  caveat: string;
}

export const COPY: Record<Locale, Copy> = {
  zh: {
    progress: k => `已编 ${k} 局`,
    undo: '撤销一局',
    reset: '重来',
    average: x => `真随机平均 ${x} 次。`,
    verdict: {
      random: '检测器认不出来：这串看起来像真随机。',
      'too-even': '换色太勤或连串太短，像人编的“太均匀”。',
      'too-streaky': '换色太少或连串太长，也不像公平随机。',
    },
    caveat: '判定规则在“公平硬币、每局独立”下精确计算：一串真随机的结果被误判的概率不到 3%。',
  },
  en: {
    progress: k => (k === 1 ? '1 round entered' : `${k} rounds entered`),
    undo: 'Undo last round',
    reset: 'Reset',
    average: x => `A truly random sequence averages ${x} changes.`,
    verdict: {
      random: "The detector can't tell: this looks like real randomness.",
      'too-even': 'Too many switches or too-short streaks. It reads like a human-made “too even” sequence.',
      'too-streaky': "Too few switches, or streaks that run too long. That doesn't look fairly random either.",
    },
    caveat: 'The thresholds come from exact calculations under a fair coin with independent rounds. A truly random sequence gets flagged less than 3% of the time.',
  },
};

export const ROUNDS = 20;

interface Props {
  locale: Locale;
  labels: {
    /** Part3-Psych.018：含 <br>，按 HTML 渲染 */
    title: string;
    red: string;
    black: string;
    longest: string;
    switches: string;
  };
}

/** 第三部分“轮到你编 20 局”。判定全部交给 engine/sequence，组件只记录点击并显示结果。 */
export default function SequenceDetector({ locale, labels }: Props) {
  const [seq, setSeq] = useState<boolean[]>([]);
  const copy = COPY[locale];
  const full = seq.length >= ROUNDS;
  const report = seq.length === ROUNDS ? assessSequence(seq) : null;

  const add = (red: boolean) => {
    if (seq.length < ROUNDS) setSeq([...seq, red]);
  };

  return (
    <div class="ch-panel p3p-try">
      <span class="p3p-try-title" dangerouslySetInnerHTML={{ __html: labels.title }} />

      <div class="p3p-grid" role="group" aria-label={copy.progress(seq.length)}>
        {Array.from({ length: ROUNDS }, (_, i) => (
          <span class={['p3p-pill', i < seq.length ? (seq[i] ? 'is-red' : 'is-black') : 'is-empty'].join(' ')} />
        ))}
      </div>

      <div class="p3p-choices">
        <button type="button" class="p3p-choice is-red" disabled={full} onClick={() => add(true)}>{labels.red}</button>
        <button type="button" class="p3p-choice is-black" disabled={full} onClick={() => add(false)}>{labels.black}</button>
      </div>

      <div class="p3p-tools">
        <button type="button" class="p3p-tool" disabled={seq.length === 0} onClick={() => setSeq(seq.slice(0, -1))}>{copy.undo}</button>
        <button type="button" class="p3p-tool" disabled={seq.length === 0} onClick={() => setSeq([])}>{copy.reset}</button>
      </div>

      <div class="p3p-result" aria-live="polite">
        {report ? (
          <>
            <div class="p3p-stat">
              <div class="p3p-result-row">
                <span>{labels.switches}</span>
                <strong class="p3p-result-num">{report.switches}</strong>
              </div>
              <span class="p3p-result-note">{copy.average(report.expectedSwitches.toFixed(1))}</span>
            </div>
            <div class="p3p-stat">
              <div class="p3p-result-row">
                <span>{labels.longest}</span>
                <strong class="p3p-result-num">{report.longest}</strong>
              </div>
            </div>
            <p class="p3p-verdict">{copy.verdict[report.verdict]}</p>
            <p class="p3p-caveat">{copy.caveat}</p>
          </>
        ) : null}
      </div>
    </div>
  );
}
