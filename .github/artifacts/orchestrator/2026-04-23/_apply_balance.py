import json, pathlib, sys

root = pathlib.Path(r"d:\Tank-Merge-Zombie-Defense\assets")

def load(p):
    return json.loads(p.read_text(encoding="utf-8"))

def dump(p, obj):
    p.write_text(json.dumps(obj, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

# tanks.json: stats.baseDamage *5 for tank_lvl1..tank_lvl60
tanks_path = root / "tanks.json"
tanks = load(tanks_path)
changed_t = 0
samples_t = []
for k, v in tanks.items():
    if not (isinstance(k, str) and k.startswith("tank_lvl")):
        continue
    if not isinstance(v, dict):
        continue
    stats = v.get("stats")
    if isinstance(stats, dict) and "baseDamage" in stats and isinstance(stats["baseDamage"], (int, float)):
        old = stats["baseDamage"]
        stats["baseDamage"] = int(round(old * 5))
        changed_t += 1
        if changed_t <= 3 or k == "tank_lvl60":
            samples_t.append(f"  {k}: stats.baseDamage {old} -> {stats['baseDamage']}")
dump(tanks_path, tanks)
print(f"tanks.json: updated {changed_t} entries")
for s in samples_t:
    print(s)

# zombies.json: Health *5 for every level entry (zombie_lvl1..zombie_lvl60)
zomb_path = root / "zombies.json"
zomb = load(zomb_path)
changed_z = 0
samples_z = []
for k, v in zomb.items():
    if not (isinstance(k, str) and k.startswith("zombie_lvl")):
        continue
    if not isinstance(v, dict):
        continue
    if "Health" in v and isinstance(v["Health"], (int, float)):
        old = v["Health"]
        v["Health"] = int(round(old * 5))
        changed_z += 1
        if changed_z <= 3 or k == "zombie_lvl60":
            samples_z.append(f"  {k}: Health {old} -> {v['Health']}")
dump(zomb_path, zomb)
print(f"zombies.json: updated {changed_z} entries")
for s in samples_z:
    print(s)
