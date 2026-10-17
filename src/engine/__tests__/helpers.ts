/** 断言模拟均值与理论值的差在 k 个标准误以内 */
export function withinSE(observed: number, expected: number, sd: number, n: number, k = 4): boolean {
  return Math.abs(observed - expected) <= (k * sd) / Math.sqrt(n);
}
