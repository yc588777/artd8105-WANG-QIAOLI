export class SeededRandom {
  private s: number;

  constructor(seed = 1) {
    this.s = (seed >>> 0) || 1;
  }

  next() {
    this.s = (1664525 * this.s + 1013904223) >>> 0;
    return this.s / 4294967296;
  }

  range(min: number, max: number) {
    return min + (max - min) * this.next();
  }

  int(min: number, max: number) {
    return Math.floor(this.range(min, max + 1));
  }

  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)]!;
  }

  get seed() {
    return this.s;
  }
}

export function hashSeed(input: string | number) {
  const s = String(input);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
