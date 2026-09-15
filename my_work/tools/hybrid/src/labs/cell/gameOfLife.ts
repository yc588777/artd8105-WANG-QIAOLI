export function neighborCount(grid: Uint8Array, cols: number, rows: number, x: number, y: number, wrap = true) {
  let n = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      let nx = x + dx;
      let ny = y + dy;
      if (wrap) {
        nx = (nx + cols) % cols;
        ny = (ny + rows) % rows;
      } else if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      if (grid[ny * cols + nx]) n++;
    }
  }
  return n;
}

export function stepLife(
  grid: Uint8Array,
  next: Uint8Array,
  cols: number,
  rows: number,
  birth: number[],
  survive: number[],
  wrap = true,
) {
  const bset = new Set(birth);
  const sset = new Set(survive);
  let live = 0;
  let changed = 0;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = y * cols + x;
      const n = neighborCount(grid, cols, rows, x, y, wrap);
      const here = grid[i]!;
      const v = here ? (sset.has(n) ? 1 : 0) : bset.has(n) ? 1 : 0;
      next[i] = v;
      if (v) live++;
      if (v !== here) changed++;
    }
  }
  return { live, changed };
}

export function placePattern(grid: Uint8Array, cols: number, rows: number, cx: number, cy: number, cells: [number, number][]) {
  for (const [dx, dy] of cells) {
    const x = cx + dx;
    const y = cy + dy;
    if (x >= 0 && y >= 0 && x < cols && y < rows) grid[y * cols + x] = 1;
  }
}

export const GLIDER: [number, number][] = [
  [1, 0],
  [2, 1],
  [0, 2],
  [1, 2],
  [2, 2],
];

export const BLINKER: [number, number][] = [
  [0, 0],
  [1, 0],
  [2, 0],
];

export const BLOCK: [number, number][] = [
  [0, 0],
  [1, 0],
  [0, 1],
  [1, 1],
];

export function matchPattern(
  grid: Uint8Array,
  cols: number,
  rows: number,
  cells: [number, number][],
): number {
  let hits = 0;
  const set = new Set(cells.map(([x, y]) => `${x},${y}`));
  const minX = Math.min(...cells.map((c) => c[0]));
  const minY = Math.min(...cells.map((c) => c[1]));
  const maxX = Math.max(...cells.map((c) => c[0]));
  const maxY = Math.max(...cells.map((c) => c[1]));
  const w = maxX - minX + 1;
  const h = maxY - minY + 1;
  const norm = cells.map(([x, y]) => [x - minX, y - minY] as [number, number]);
  void set;
  for (let y = 0; y < rows - h; y++) {
    for (let x = 0; x < cols - w; x++) {
      let ok = true;
      for (const [dx, dy] of norm) {
        if (!grid[(y + dy) * cols + (x + dx)]) {
          ok = false;
          break;
        }
      }
      if (ok) hits++;
    }
  }
  return hits;
}

export function densityEntropy(grid: Uint8Array) {
  let live = 0;
  for (let i = 0; i < grid.length; i++) if (grid[i]) live++;
  const p = live / grid.length;
  if (p <= 0 || p >= 1) return 0;
  return -(p * Math.log2(p) + (1 - p) * Math.log2(1 - p));
}

export function cloneGrid(grid: Uint8Array) {
  return new Uint8Array(grid);
}
