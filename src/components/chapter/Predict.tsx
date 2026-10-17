import { useState } from 'preact/hooks';
import type { Locale } from '../../i18n/site';
import { UI } from '../../i18n/ui';

interface Props {
  locale: Locale;
  /** 选项组的无障碍标签（common.030“选项”） */
  label: string;
  options: string[];
  /** 正确选项的下标，从 0 开始 */
  answer: number;
}

/**
 * “先猜”选择题：选一次就锁定，标出正确答案，并提示往下看。
 * 只负责交互，不判断数学：answer 由页面根据下文的结论写死，审稿时核对。
 */
export default function Predict({ locale, label, options, answer }: Props) {
  const [picked, setPicked] = useState<number | null>(null);
  const done = picked !== null;
  const ui = UI[locale];
  return (
    <div class="ch-predict">
      <div role="radiogroup" aria-label={label} class="ch-options">
        {options.map((text, i) => (
          <button
            type="button"
            role="radio"
            aria-checked={picked === i}
            aria-disabled={done && picked !== i}
            class={['ch-option', done && i === answer ? 'is-answer' : '', done && picked === i && i !== answer ? 'is-wrong' : ''].join(' ').trim()}
            onClick={() => { if (!done) setPicked(i); }}
          >
            <span class="ch-radio" aria-hidden="true" />
            <span>{text}</span>
          </button>
        ))}
      </div>
      <p class="ch-feedback" aria-live="polite">
        {done ? `${picked === answer ? ui.right : ui.wrong}${ui.answer(options[answer])}` : ''}
      </p>
    </div>
  );
}
