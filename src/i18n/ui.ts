import type { Locale } from './site';

/** 页面框架自带的界面文字（不来自设计稿，所以不在 i18n/source 里） */
export const UI: Record<Locale, { right: string; wrong: string; answer: (option: string) => string }> = {
  zh: {
    right: '猜对了。',
    wrong: '没猜中。',
    answer: option => `答案是“${option}”。往下看为什么。`,
  },
  en: {
    right: 'You got it.',
    wrong: 'Not quite.',
    answer: option => `The answer is “${option}”. Read on to see why.`,
  },
};
