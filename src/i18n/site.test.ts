import { describe, expect, it } from 'vitest';
import { money } from './site';

describe('money()', () => {
  it('formats hypothetical stakes as yuan (zh) and dollars (en)', () => {
    expect(money(1234, 'zh')).toBe('+1,234 元');
    expect(money(-1234, 'en')).toBe('−$1,234');
    expect(money(6.5, 'en', false)).toBe('$6.50');
    expect(money(52.6, 'en', false)).toBe('$52.6');
  });

  it('keeps real Chinese prices in yuan on the English site', () => {
    expect(money(1495, 'en', false, 'CNY')).toBe('1,495 yuan');
    expect(money(-2, 'en', true, 'CNY')).toBe('−2 yuan');
    expect(money(1495, 'zh', false, 'CNY')).toBe('1,495 元');
  });

  it('formats verb amounts without signs and groups four-digit stakes', () => {
    expect(money(-10, 'en', false)).toBe('$10');
    expect(money(10, 'en', false)).toBe('$10');
    expect(money(1000, 'en', false)).toBe('$1,000');
    expect(money(-10, 'zh')).toBe('−10 元');
  });

  it('drops the sign for amounts that round to zero', () => {
    expect(money(0.04, 'en')).toBe('$0.04');
    expect(money(0, 'zh')).toBe('0 元');
  });
});
