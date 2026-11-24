/**
 * Checks that four weave patterns share one locked master shell.
 * Run while the API is up: npx tsx scripts/validateFanGeometry.ts
 */
const base = {
  pattern: "radial",
  geometry_lock: true,
  print_safe: true,
  t_min: 0,
  t_max: 2.2,
  rim_width: 3.6,
  contrast: 1.35,
  dark_levels: 4,
  smoothness: 0.15,
  invert: false,
  density_u: 1.2,
  density_v: 1.2,
  strand_width_u: 1.6,
  strand_width_v: 1.6,
  relief: 0.4,
  weave_angle: 0,
  frequency: 1.2,
  amplitude: 2.2,
  randomness: 0,
  seed: 7,
  blend_radius: 14,
  target_height: 180,
  frame_mm: 2.6,
  zones: {},
  polygons: [],
  brush: null,
};

async function preview(pattern: string) {
  const res = await fetch("http://127.0.0.1:8787/api/validate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ params: { ...base, pattern }, quality: "draft" }),
  });
  if (!res.ok) throw new Error(await res.text());
  const body = await res.json();
  return body.report as Record<string, unknown>;
}

const patterns = ["radial", "diamond", "ripple", "cellular"];
const reports = [];
for (const pattern of patterns) {
  const report = await preview(pattern);
  reports.push(report);
  const flags = ["geometry_lock", "outer_silhouette", "guard_consistency", "handle_consistency", "printable_mesh"];
  console.log(
    pattern,
    flags.map((key) => `${key}=${report[key]}`).join(" "),
    `size=${report.width_mm}x${report.height_mm}`,
    `dev=${report.silhouette_deviation_mm}`,
  );
}
const hashes = new Set(reports.map((item) => item.fixed_hash));
const sizes = new Set(reports.map((item) => `${item.width_mm}|${item.height_mm}|${item.guard_width_mm}|${item.handle_length_mm}`));
if (hashes.size !== 1) {
  console.error("FAIL fixed hash differs between patterns");
  process.exit(1);
}
if (sizes.size !== 1) {
  console.error("FAIL outer size differs between patterns");
  process.exit(1);
}
console.log("PASS shared master shell");
