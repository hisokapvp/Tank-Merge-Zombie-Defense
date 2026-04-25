"""
batch solo-pipeline-yandex-vk#1 — Steps 2+3:
- Remove aura1/aura2/aura3 from tank_lvl1..tank_lvl55 (keep on 56-60).
- Apply to both assets/tanks.json (src) and dist/release/staging/assets/tanks.json (release mirror).
- Pattern: tier-visual-registry is implicit via presence of keys; pickAura returns null gracefully when missing.
"""
import json, io, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PATHS = [
    os.path.join(ROOT, 'assets', 'tanks.json'),
    os.path.join(ROOT, 'dist', 'release', 'staging', 'assets', 'tanks.json'),
]

KEEP_LEVELS = {56, 57, 58, 59, 60}

def process(path):
    with io.open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    cfg = data.get('tankConfig') or data
    removed = 0
    kept = 0
    for k in list(cfg.keys()):
        if not k.startswith('tank_lvl'):
            continue
        try:
            L = int(k.replace('tank_lvl', ''))
        except ValueError:
            continue
        t = cfg[k]
        if not isinstance(t, dict):
            continue
        if L in KEEP_LEVELS:
            if any(a in t for a in ('aura1', 'aura2', 'aura3')):
                kept += 1
            continue
        for akey in ('aura1', 'aura2', 'aura3'):
            if akey in t:
                del t[akey]
                removed += 1
    with io.open(path, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write('\n')
    print('[{}] removed aura keys: {}, tanks keeping aura (56-60): {}'.format(os.path.relpath(path, ROOT), removed, kept))

for p in PATHS:
    if os.path.exists(p):
        process(p)
    else:
        print('[skip] not found:', p)
