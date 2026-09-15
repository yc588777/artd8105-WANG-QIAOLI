export function nextElementaryRow(prev: Uint8Array, rule: number, wrap = true) {
  const n = prev.length;
  const out = new Uint8Array(n);
  const r = rule & 255;
  for (let x = 0; x < n; x++) {
    const left = wrap ? prev[(x - 1 + n) % n]! : x === 0 ? 0 : prev[x - 1]!;
    const mid = prev[x]!;
    const right = wrap ? prev[(x + 1) % n]! : x === n - 1 ? 0 : prev[x + 1]!;
    const idx = (left << 2) | (mid << 1) | right;
    out[x] = (r >> idx) & 1;
  }
  return out;
}

export function ruleBits(rule: number) {
  const r = rule & 255;
  return Array.from({ length: 8 }, (_, i) => (r >> i) & 1);
}

export function wolframClassHint(rule: number) {
  if (rule === 0 || rule === 255 || rule === 8 || rule === 32) return "class1";
  if (rule === 90 || rule === 150 || rule === 184) return "class2";
  if (rule === 30 || rule === 45) return "class3";
  if (rule === 110 || rule === 54) return "class4";
  return "unknown";
}

export function rowEntropy(row: Uint8Array) {
  let live = 0;
  for (let i = 0; i < row.length; i++) if (row[i]) live++;
  const p = live / row.length;
  if (p <= 0 || p >= 1) return 0;
  return -(p * Math.log2(p) + (1 - p) * Math.log2(1 - p));
}
