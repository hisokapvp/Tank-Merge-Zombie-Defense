import json, io, sys
with io.open('assets/tanks.json','r',encoding='utf-8') as f:
    d = json.load(f)
cfg = d.get('tankConfig') or d
keys = sorted([k for k in cfg.keys() if k.startswith('tank_lvl')], key=lambda k: int(k.replace('tank_lvl','')))
print('levels:', len(keys))
samples = [1,2,3,5,10,20,30,42,50,55,56,57,58,59,60]
for L in samples:
    k = 'tank_lvl' + str(L)
    if k in cfg:
        s = cfg[k].get('stats', {})
        has_aura1 = 'aura1' in cfg[k]
        has_aura2 = 'aura2' in cfg[k]
        has_aura3 = 'aura3' in cfg[k]
        has_aura  = 'aura' in cfg[k]
        print('L{:>2}: ms={} as={} bd={} aura={} a1={} a2={} a3={}'.format(
            L, s.get('moveSpeed'), s.get('attackSpeed'), s.get('baseDamage'),
            has_aura, has_aura1, has_aura2, has_aura3))
aura_levels = []
aura123_levels = []
for k in keys:
    L = int(k.replace('tank_lvl',''))
    t = cfg[k]
    if 'aura' in t:
        aura_levels.append(L)
    if 'aura1' in t or 'aura2' in t or 'aura3' in t:
        aura123_levels.append(L)
print('aura (single) levels:', aura_levels)
print('aura1/2/3 levels:', aura123_levels)
