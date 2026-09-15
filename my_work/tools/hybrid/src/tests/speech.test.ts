import { describe, expect, it } from "vitest";
import { formatKelly } from "../labs/hybrid/speech/codes";
import { lyricsToKelly, parseKellyStream, textToPhonemes } from "../labs/hybrid/speech/g2p";
import { compileLyrics } from "../labs/hybrid/speech/engine";
import { scorePhonemes } from "../labs/hybrid/speech/score";
import { cardsToFrames, frameAt } from "../labs/hybrid/speech/tract";
import { frameMotion } from "../labs/hybrid/speech/motion";

describe("Kelly–Gerstman lyrics", () => {
  it("splits He saw the cat into the Bell Labs card sequence", () => {
    expect(textToPhonemes("He saw the cat")).toEqual(["H", "EE", "S", "AW", "DH", "UH", "K", "AE", "T"]);
    expect(lyricsToKelly("He saw the cat")).toBe("H—EE—S—AW—DH—UH—K—AE—T");
  });

  it("accepts already-split punched-card phonemes", () => {
    expect(parseKellyStream("H—EE—S—AW—DH—UH—K—AE—T")).toEqual(["H", "EE", "S", "AW", "DH", "UH", "K", "AE", "T"]);
    expect(textToPhonemes("H EE S AW DH UH K AE T")).toEqual(["H", "EE", "S", "AW", "DH", "UH", "K", "AE", "T"]);
  });

  it("covers Daisy Bell opening words", () => {
    expect(formatKelly(textToPhonemes("Daisy"))).toBe("D—AY—Z—EE");
    expect(textToPhonemes("give me your answer do").slice(0, 3)).toEqual(["G", "I", "V"]);
  });

  it("maps a Chinese lyric line through pinyin", () => {
    const ph = textToPhonemes("他看见猫");
    expect(ph[0]).toBe("T");
    expect(ph).toContain("AH");
    expect(ph).toContain("K");
    expect(ph).toContain("M");
  });
});

describe("score and tract", () => {
  it("assigns pitch and duration then emits nine control fields", () => {
    const cards = scorePhonemes(textToPhonemes("He saw the cat"), { sing: true, rate: 1, pitch: 120 });
    expect(cards.length).toBe(9);
    expect(cards.every((c) => c.dur > 0 && c.pitch > 50)).toBe(true);
    const vowels = cards.filter((c) => c.vowel);
    expect(vowels.length).toBeGreaterThanOrEqual(4);
    expect(vowels[0]!.pitch).not.toBe(vowels[1]!.pitch);

    const frames = cardsToFrames(cards);
    expect(frames.length).toBeGreaterThan(20);
    const f = frameAt(frames, 0.05)!;
    expect(f.f1).toBeGreaterThan(100);
    expect(f.dur).toBeGreaterThan(0);
    expect(f.durScale).toBe(1);
    expect(f.f2).toBeGreaterThan(f.f1);
    expect(f.f3).toBeGreaterThan(f.f2);
    expect(f.buzz + f.hiss).toBeGreaterThanOrEqual(0);
    expect(f.tongueFront).toBeGreaterThanOrEqual(0);
    expect(f.tongueOpen).toBeLessThanOrEqual(1);
  });

  it("compileLyrics fills the five-step payload", () => {
    const c = compileLyrics("He saw the cat", { sing: false, rate: 1, pitch: 110 });
    expect(c.kelly).toBe("H—EE—S—AW—DH—UH—K—AE—T");
    expect(c.cards.length).toBe(c.phonemes.length);
    expect(c.duration).toBeGreaterThan(0.4);
    expect(c.frames[0]!.ph).toBe("H");
  });
});

describe("camera frame difference", () => {
  it("reports energy and centroid when a block moves", () => {
    const w = 8;
    const h = 8;
    const prev = new Uint8ClampedArray(w * h * 4);
    const next = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) {
      prev[i * 4] = 10;
      prev[i * 4 + 1] = 10;
      prev[i * 4 + 2] = 10;
      prev[i * 4 + 3] = 255;
      next[i * 4] = 10;
      next[i * 4 + 1] = 10;
      next[i * 4 + 2] = 10;
      next[i * 4 + 3] = 255;
    }
    for (let y = 2; y < 5; y++) {
      for (let x = 5; x < 8; x++) {
        const i = (y * w + x) * 4;
        next[i] = 220;
        next[i + 1] = 220;
        next[i + 2] = 220;
      }
    }
    const m = frameMotion(prev, next, w, h, 20);
    expect(m.energy).toBeGreaterThan(0.01);
    expect(m.cx).toBeGreaterThan(0.5);
  });
});
