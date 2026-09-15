export function bioRgb(u: number, v: number, mode: 0 | 1 | 2): [number, number, number] {
  const a = Math.max(0, Math.min(1, u));
  const b = Math.max(0, Math.min(1, v));
  if (mode === 0) {
    const g = a;
    return [g * 20, g * 80, 40 + g * 180];
  }
  if (mode === 1) {
    const c = Math.max(0, Math.min(1, b * 2.2));
    return [c * 255, c * 140, 40 + (1 - c) * 80];
  }
  const c = Math.max(0, Math.min(1, b * 3));
  return [
    c > 0.5 ? (c - 0.5) * 510 : 0,
    c * 150,
    Math.min(255, c * 255 + (1 - a) * 150),
  ];
}

export function fhnRgb(u: number, v: number, noise = 0): [number, number, number] {
  const intensity = Math.max(0, Math.min(1, u * 1.55));
  const refractory = Math.max(0, Math.min(1, v * 1.25));
  let r = 10 + refractory * 22;
  let g = 22 + refractory * 55;
  let b = 40 + refractory * 120;
  if (intensity > 0.04) {
    r += intensity * 90;
    g += intensity * 220;
    b += intensity * 255;
    if (intensity > 0.42) {
      const core = (intensity - 0.42) / 0.58;
      r += core * 255;
      g += core * 90;
      b -= core * 80;
    }
  }
  return [
    Math.max(0, Math.min(255, r + noise)),
    Math.max(0, Math.min(255, g + noise)),
    Math.max(0, Math.min(255, b + noise)),
  ];
}
