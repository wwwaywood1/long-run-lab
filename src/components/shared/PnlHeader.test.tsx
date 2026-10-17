import { expect, it } from 'vitest';
import renderToString from 'preact-render-to-string';
import PnlHeader from './PnlHeader';
it('keeps Chinese real-money pages in yuan while preserving existing dollar stakes', () => {
  const props = { pnl: -1234, locale: 'en' as const, label: 'Your net', meta: '1 draw' };
  expect(renderToString(<PnlHeader {...props} currency="CNY" />)).toContain('−1,234 yuan');
  expect(renderToString(<PnlHeader {...props} />)).toContain('−$1,234');
  expect(renderToString(<PnlHeader {...props} locale="zh" currency="CNY" />)).toContain('−1,234 元');
});
