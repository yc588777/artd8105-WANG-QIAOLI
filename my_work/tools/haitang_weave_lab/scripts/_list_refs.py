from pathlib import Path

print("home", Path.home())
roots = [Path.home() / "Downloads", Path(r"C:\Users") ]
# find the user downloads by walking one level
cands = []
users = Path(r"C:\Users")
for user in users.iterdir():
    d = user / "Downloads"
    if d.is_dir():
        cands.append(d)
print("download dirs", cands)
out = Path(__file__).resolve().parents[1] / "exports" / "_refs.txt"
lines = []
for root in cands:
    stls = [p for p in root.iterdir() if p.suffix.lower() == ".stl"]
    lines.append(f"DIR {root} stl_count={len(stls)}")
    for p in stls:
        lines.append(f"{p.stat().st_size}\t{p.name}")
    for p in root.iterdir():
        if p.suffix.lower() == ".png" and ("1" in p.name and p.stat().st_size > 100_000):
            if "灰" in p.name or "扇" in p.name or "模板" in p.name:
                lines.append(f"PNG {p.stat().st_size}\t{p.name}")
text = "\n".join(lines)
out.write_text(text, encoding="utf-8")
print(text[:4000])
