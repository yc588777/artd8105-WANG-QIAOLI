import type { RuleMap } from "./lsystemEngine";

export type GrowPreset = {
  id: string;
  zh: string;
  en: string;
  axiom: string;
  rules: RuleMap;
  angle: number;
  iters: number;
  parametric?: boolean;
};

export const GROW_PRESETS: GrowPreset[] = [
  {
    id: "tree",
    zh: "分形树",
    en: "Fractal tree",
    axiom: "F",
    rules: { F: "F[+F]F[-F][F]" },
    angle: 25.7,
    iters: 4,
  },
  {
    id: "koch",
    zh: "Koch 曲线",
    en: "Koch curve",
    axiom: "F",
    rules: { F: "F+F-F-F+F" },
    angle: 90,
    iters: 3,
  },
  {
    id: "fern",
    zh: "蕨类",
    en: "Fern",
    axiom: "X",
    rules: { X: "F+[[X]-X]-F[-FX]+X", F: "FF" },
    angle: 22.5,
    iters: 5,
  },
  {
    id: "bush",
    zh: "灌木",
    en: "Bush",
    axiom: "F",
    rules: { F: ["FF-[-F+F+F]+[+F-F-F]", "FF+[+F-F-F]-[-F+F+F]"] },
    angle: 22.5,
    iters: 3,
  },
  {
    id: "city",
    zh: "城市路网",
    en: "Street network",
    axiom: "F",
    rules: { F: "F[+F][-F]F" },
    angle: 90,
    iters: 4,
  },
  {
    id: "param",
    zh: "参数化（进阶）",
    en: "Parametric",
    axiom: "F",
    rules: { F: "F[+F]F[-F]F" },
    angle: 20,
    iters: 4,
    parametric: true,
  },
];
