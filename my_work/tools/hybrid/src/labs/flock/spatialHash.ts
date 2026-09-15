export class SpatialHash {
  cell: number;
  private buckets = new Map<number, number[]>();

  constructor(cell = 48) {
    this.cell = cell;
  }

  clear() {
    this.buckets.clear();
  }

  private key(cx: number, cy: number) {
    return ((cx * 73856093) ^ (cy * 19349663)) | 0;
  }

  insert(i: number, x: number, y: number) {
    const cx = Math.floor(x / this.cell);
    const cy = Math.floor(y / this.cell);
    const k = this.key(cx, cy);
    let b = this.buckets.get(k);
    if (!b) {
      b = [];
      this.buckets.set(k, b);
    }
    b.push(i);
  }

  query(x: number, y: number, r: number, visit: (i: number) => void) {
    const minX = Math.floor((x - r) / this.cell);
    const maxX = Math.floor((x + r) / this.cell);
    const minY = Math.floor((y - r) / this.cell);
    const maxY = Math.floor((y + r) / this.cell);
    const seen = new Set<number>();
    for (let cy = minY; cy <= maxY; cy++) {
      for (let cx = minX; cx <= maxX; cx++) {
        const b = this.buckets.get(this.key(cx, cy));
        if (!b) continue;
        for (const i of b) {
          if (seen.has(i)) continue;
          seen.add(i);
          visit(i);
        }
      }
    }
  }
}
