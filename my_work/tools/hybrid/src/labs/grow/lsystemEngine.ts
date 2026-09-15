export type RuleMap = Record<string, string | string[]>;

export const MAX_STRING = 72000;

export function expandLSystem(
  axiom: string,
  rules: RuleMap,
  iterations: number,
  rnd: () => number = Math.random,
  maxLen = MAX_STRING,
) {
  let s = axiom;
  const generations = [s];
  for (let i = 0; i < iterations; i++) {
    let next = "";
    for (let k = 0; k < s.length; k++) {
      const ch = s[k]!;
      const r = rules[ch];
      if (!r) next += ch;
      else if (Array.isArray(r)) next += r.length ? r[Math.floor(rnd() * r.length)]! : ch;
      else next += r;
      if (next.length > maxLen) {
        generations.push(next.slice(0, maxLen));
        return { str: next.slice(0, maxLen), generations, truncated: true };
      }
    }
    s = next;
    generations.push(s);
  }
  return { str: s, generations, truncated: false };
}

export function parseRules(text: string): RuleMap {
  const rules: RuleMap = {};
  for (const line of text.split(/\n|;/)) {
    const t = line.trim();
    if (!t) continue;
    const m = t.split(/=>|→|->|=/);
    if (m.length < 2) continue;
    const pred = m[0]!.trim();
    const succ = m.slice(1).join("=").trim();
    if (!pred) continue;
    const key = pred[0]!;
    const alts = succ.split("|").map((x) => x.trim()).filter(Boolean);
    if (alts.length > 1) rules[key] = alts;
    else rules[key] = alts[0] ?? succ;
  }
  return rules;
}

export function rulesToText(rules: RuleMap) {
  return Object.entries(rules)
    .map(([k, v]) => `${k} → ${Array.isArray(v) ? v.join(" | ") : v}`)
    .join("\n");
}
