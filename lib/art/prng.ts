/**
 * 결정적 PRNG — mulberry32.
 * 같은 seed 면 같은 난수 시퀀스를 반환 → 같은 너트는 언제 봐도 같은 아트.
 */

export type PRNG = () => number;

export function mulberry32(seed: number): PRNG {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 문자열 → 정수 해시 (FNV-1a 32bit) */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** seed 문자열로부터 PRNG */
export function rngFromSeed(seed: string): PRNG {
  return mulberry32(hashString(seed));
}

export function randInt(rng: PRNG, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

export function pick<T>(rng: PRNG, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

export function chance(rng: PRNG, p: number): boolean {
  return rng() < p;
}
