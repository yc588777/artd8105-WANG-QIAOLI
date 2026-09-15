export const C = {
  ink: "#08090A",
  paper: "#EEEDE8",
  ash: "#8D9295",
  graphite: "#26292C",
  coral: "#F06455",
  blue: "#315BFF",
  lime: "#9AFF4A",
  yellow: "#F2E85C",
};

export function rgba(hex: string, a: number) {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${a})`;
}
