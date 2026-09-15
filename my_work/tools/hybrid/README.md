# HYBRID.06 — Morphosystem / Algorithm Explorer

Session 4 homework: a Cursor-built design system that can recreate the original mix (flock + growth + reaction–diffusion, pyrocystis drawing) and then vary the rules into new works (lyrics → Kelly–Gerstman phoneme cards → tract synthesis; camera motion rewriting picture and sound; random-vision wander).

This is the system that locally ran at `http://localhost:5173/` (home) and `http://localhost:5173/hybrid` (HYBRID.06 lyric text input). **Do not submit localhost.**

**Open online (same as the local site):**  
https://yc588777.github.io/artd8105-WANG-QIAOLI/explorer/  
HYBRID.06 text input:  
https://yc588777.github.io/artd8105-WANG-QIAOLI/explorer/#/hybrid

## Run

From this folder:

```bash
npm install
npm run dev
```

Then open `/hybrid` (HYBRID.06). The five single-algorithm labs are under `/lab/gene` … `/lab/diff`.

Camera motion needs a secure context: use `http://localhost:5173`, not a LAN IP.

## Recreate / vary

- Default mix: flock + L-system + Gray–Scott, pyrocystis as the visible body.
- Shortcuts A / B / C and RANDOM MIX / 随机视觉 rewrite couplings and parameters.
- Lyric presets include *He saw the cat* → `H—EE—S—AW—DH—UH—K—AE—T` (Bell Labs *Computer Speech*).
- PLAY TAPE synthesises the tract; 捕捉动态 maps motion onto every layer plus PITCH / DUR / TRACT.

## Tests

```bash
npm test
```
