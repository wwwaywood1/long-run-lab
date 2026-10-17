import { expect, it } from 'vitest';
import renderToString from 'preact-render-to-string';
import LossConversion from './LossConversion';
import { makeCopy } from '../../i18n/copy';
import source from '../../../i18n/source/common.json';
const t = makeCopy({ label: '输掉的钱 {{itemText}}' }, source);
it.each([
  [5, 'stake', '1 coffee'], [10, 'stake', '2 coffees'],
  [120, 'stake', '1 pair of sneakers'], [500, 'stake', "1 month's groceries"],
  [20, 'CNY', '1 bubble tea'], [40, 'CNY', '2 bubble teas'],
] as const)('formats a whole loss sentence for %s %s', (loss, currency, items) => {
  const html = renderToString(<LossConversion loss={loss} locale="en" label={t.en.label} currency={currency} />);
  expect(html).toContain(`Lost so far ≈ ${items}`);
});
it('preserves the Chinese sentence and omits conversion below the minimum price', () => {
  expect(renderToString(<LossConversion loss={40} locale="zh" label={t.zh.label} />)).toContain('输掉的钱 ≈ 2 杯奶茶');
  expect(renderToString(<LossConversion loss={0} locale="en" label={t.en.label} />)).toBe('');
});
