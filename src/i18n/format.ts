/**
 * 数字显示。全站统一用 en-US 千分位（1,900），中英文一致，见 docs/TRANSLATION.md 第 1 条。
 */

/**
 * 概率显示成百分数。
 * - 小于 1%：2 位有效数字（0.0027%）
 * - 1% 到 50%：1 位小数（47.4%）
 * - 大于 50%：按“离 100% 还差多少”决定小数位，保证不会四舍五入成 100%（99.997%）
 */
export function formatChance(p: number): string {
  if (!(p > 0)) return '0%';
  if (p >= 1) return '100%';
  const pct = p * 100;
  if (p < 0.5) {
    if (pct < 0.0001) return '< 0.0001%';
    if (pct < 1) return `${Number(pct.toPrecision(2))}%`;
    return `${pct.toFixed(1)}%`;
  }
  const rest = 100 - pct;
  if (rest < 0.0001) return '> 99.9999%';
  const digits = rest >= 1 ? 1 : Math.ceil(-Math.log10(rest));
  return `${pct.toFixed(digits)}%`;
}

/** “大约多少”：100 以下取整，100 以上保留 2 位有效数字（1,899.9 → 1,900） */
export function roughCount(n: number): string {
  const v = n < 100 ? Math.round(n) : Number(n.toPrecision(2));
  return v.toLocaleString('en-US');
}

/** 千分位整数：37,650 */
export const intCount = (n: number) => Math.round(n).toLocaleString('en-US');
