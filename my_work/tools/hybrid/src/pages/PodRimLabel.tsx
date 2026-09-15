import {
  bottomInnerPoints,
  pointsToPath,
  polylineLength,
  topInnerPoints,
  trimGentle,
  type PodRadii,
} from "../render/podRim";

function fitSize(text: string, pathLen: number, want: number) {
  const usable = Math.max(24, pathLen * 0.86);
  const units = [...text].reduce((n, ch) => {
    if (ch === " ") return n + 0.32;
    return n + (ch.charCodeAt(0) > 0xff ? 1.02 : 0.58);
  }, 0);
  if (units <= 0) return want;
  return Math.max(8, Math.min(want, usable / units));
}

export function PodRimLabel({
  id,
  box,
  radii,
  primary,
  scale,
  secondary,
  active,
}: {
  id: string;
  box: { w: number; h: number; bw?: number; bh?: number };
  radii: PodRadii;
  primary: string;
  scale: string;
  secondary: string;
  active: boolean;
}) {
  if (box.w < 8 || box.h < 8) return null;

  const borderBox = box.bw && box.bh ? { w: box.bw, h: box.bh } : undefined;
  const inset = Math.max(5, Math.min(7, Math.round(Math.min(box.w, box.h) * 0.014 + 4)));
  const topPts = trimGentle(topInnerPoints(box.w, box.h, radii, inset, borderBox), "top", 0.72);
  const botPts = trimGentle(
    bottomInnerPoints(box.w, box.h, radii, inset, borderBox),
    "bottom",
    active ? 0.78 : 0.72,
  );
  const topId = `${id}-top`;
  const botId = `${id}-bot`;
  const bottomText = active ? secondary : scale;
  const want = Math.max(9, Math.min(12.5, Math.round(Math.min(box.w, box.h) * 0.03)));
  const topSize = fitSize(primary, polylineLength(topPts), want);
  const botSize = fitSize(bottomText, polylineLength(botPts), Math.max(8, want - (active ? 0.5 : 0)));

  return (
    <svg
      className="pod-rim"
      viewBox={`0 0 ${box.w} ${box.h}`}
      width={box.w}
      height={box.h}
      preserveAspectRatio="xMinYMin meet"
      aria-hidden="true"
    >
      <path id={topId} d={pointsToPath(topPts)} fill="none" stroke="none" />
      <path id={botId} d={pointsToPath(botPts)} fill="none" stroke="none" />
      <text className="pod-rim-text" style={{ fontSize: topSize }} dy="0.78em" textAnchor="middle">
        <textPath href={`#${topId}`} startOffset="50%" method="align" spacing="exact">
          {primary}
        </textPath>
      </text>
      <text
        className={active ? "pod-rim-text pod-rim-text-sub" : "pod-rim-text pod-rim-text-scale"}
        style={{ fontSize: botSize }}
        dy="-0.08em"
        dominantBaseline="ideographic"
        textAnchor="middle"
      >
        <textPath href={`#${botId}`} startOffset="50%" method="align" spacing="exact">
          {bottomText}
        </textPath>
      </text>
    </svg>
  );
}
