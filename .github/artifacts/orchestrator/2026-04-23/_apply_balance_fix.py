import json, pathlib

root = pathlib.Path(r"d:\Tank-Merge-Zombie-Defense\assets")

def load(p):
    return json.loads(p.read_text(encoding="utf-8"))

def dump(p, obj):
    p.write_text(json.dumps(obj, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

# tanks.json: divide stats.baseDamage by 5 (revert the accidental double-mult).
# Net effect after this script vs HEAD: 5x exactly.
tanks_path = root / "tanks.json"
tanks = load(tanks_path)
fixed_t = 0
for k, v in tanks.items():
    if not (isinstance(k, str) and k.startswith("tank_lvl") and isinstance(v, dict)):
        continue
    stats = v.get("stats")
    if isinstance(stats, dict) and "baseDamage" in stats and isinstance(stats["baseDamage"], (int, float)):
        old = stats["baseDamage"]
        new = int(round(old / 5))
        stats["baseDamage"] = new
        fixed_t += 1
dump(tanks_path, tanks)
print(f"tanks.json: corrected {fixed_t} entries (divided by 5 to undo double-mult)")

# zombies.json: types is a list of zombie tier dicts each holding Health.
# Multiply by 5 (HEAD baseline confirmed unchanged).
zomb_path = root / "zombies.json"
zomb = load(zomb_path)
types = zomb.get("types") or []
changed_z = 0
samples = []
for entry in types:
    if isinstance(entry, dict) and "Health" in entry and isinstance(entry["Health"], (int, float)):
        old = entry["Health"]
        entry["Health"] = int(round(old * 5))
        changed_z += 1
        if changed_z <= 3 or changed_z == 60:
            samples.append(f"  types[{changed_z-1}] {entry.get('id','?')}: Health {old} -> {entry['Health']}")
dump(zomb_path, zomb)
print(f"zombies.json: updated {changed_z} entries (Health x5)")
for s in samples:
    print(s)

# Verify tanks final state matches HEAD * 5
import subprocess
head = json.loads(subprocess.check_output(['git','show','HEAD:assets/tanks.json'], cwd=r'd:\Tank-Merge-Zombie-Defense', text=True))
mismatches = 0
for k, v in tanks.items():
    if isinstance(k, str) and k.startswith("tank_lvl") and isinstance(v, dict):
        s = v.get("stats", {}).get("baseDamage")
        h = head.get(k, {}).get("stats", {}).get("baseDamage")
        if s is None or h is None: continue
        if s != int(round(h * 5)):
            mismatches += 1
            if mismatches <= 5:
                print(f"  MISMATCH {k}: head*5={h*5} cur={s}")
print(f"tanks.json verify: mismatches={mismatches} (expected 0)")
