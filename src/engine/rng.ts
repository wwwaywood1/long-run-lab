/**
 * 随机数工具。所有引擎函数都接受一个 Rng 参数：
 * 网页里用 Math.random，测试和研究复现时用可设种子的 mulberry32，结果可完全重现。
 */
export type Rng = () => number;

export const defaultRng: Rng = Math.random;

/** Mulberry32：32 位可设种子的伪随机数生成器，周期 2^32，足够做教学模拟。 */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 0..n-1 的均匀整数 */
export function randInt(rng: Rng, n: number): number {
  return Math.floor(rng() * n);
}

/** 原地 Fisher–Yates 洗牌 */
export function shuffle<T>(arr: T[], rng: Rng): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randInt(rng, i + 1);
    const t = arr[i];
    arr[i] = arr[j];
    arr[j] = t;
  }
  return arr;
}

/** 从 1..max 中不放回抽 n 个，升序返回 */
export function sampleSorted(rng: Rng, n: number, max: number): number[] {
  const a = Array.from({ length: max }, (_, i) => i + 1);
  for (let j = 0; j < n; j++) {
    const k = j + randInt(rng, max - j);
    const t = a[j];
    a[j] = a[k];
    a[k] = t;
  }
  return a.slice(0, n).sort((x, y) => x - y);
}
