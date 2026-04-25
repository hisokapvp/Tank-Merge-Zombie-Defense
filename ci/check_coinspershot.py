"""
batch solo-pipeline-yandex-vk#1 — Step 5 curve validator:
Validate assets/levelreward.json coinsPerShot.perLevel against curve 2^(level-1) for all 60 levels.
Fails if any level is missing or flat-plateau'd.
Run: python ci\check_coinspershot.py
"""
import json, io, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
path = os.path.join(ROOT, 'assets', 'levelreward.json')
with io.open(path, 'r', encoding='utf-8') as f:
    data = json.load(f)

cps = data.get('coinsPerShot') or {}
per = cps.get('perLevel') or {}
errors = []
for L in range(1, 61):
    expected = 2 ** (L - 1)
    actual = per.get(str(L))
    if actual is None:
        errors.append('L{}: missing perLevel entry'.format(L))
        continue
    if actual != expected:
        errors.append('L{}: expected {}, got {}'.format(L, expected, actual))

# Plateau detection: any 5 consecutive levels with identical value = fail
vals = [per.get(str(L)) for L in range(1, 61)]
for i in range(len(vals) - 4):
    window = vals[i:i + 5]
    if None not in window and len(set(window)) == 1:
        errors.append('Plateau detected at levels L{}-L{}: value={}'.format(i + 1, i + 5, window[0]))

help_text = cps.get('_formulaHelp') or ''
if '2^(level-1)' not in help_text:
    errors.append('_formulaHelp must document "2^(level-1)" contract')

if errors:
    print('FAIL: coinsPerShot validation')
    for e in errors:
        print('  -', e)
    sys.exit(1)
print('OK: coinsPerShot curve 2^(level-1) valid for all 60 levels; _formulaHelp in sync.')
