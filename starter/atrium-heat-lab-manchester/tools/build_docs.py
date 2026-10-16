"""
Build the shareable team docs from the sources, so they never drift:

    python tools/build_docs.py

  data/design_catalogue.json  ->  docs/ANALYSES.md          (analyses + interventions breakdown)
  docs/heat-ledger.html       ->  docs/share/heat-ledger.html      (standalone pages: email them,
  docs/atrium-toolchain.html  ->  docs/share/atrium-toolchain.html  open offline, or print to PDF)
docs/TEAM_GUIDE.md is written by hand and links to both.
"""
import os
import json

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOCS = os.path.join(ROOT, 'docs')
LEVEL = {'yes': 'Analysable now', 'partial': 'Partial', 'approx': 'Approximation', 'no': 'Needs new simulation'}
HOW = {'e+': 'EnergyPlus sweep', 'js': 'in the app (JS)', 'external': 'other engine'}


def cell(v):
    return (str(v) if v not in (None, '') else '–').replace('|', '\\|').replace('\n', ' ')


def table(items, cols):
    head = '| ' + ' | '.join(c[0] for c in cols) + ' |\n|' + '---|' * len(cols) + '\n'
    return head + ''.join('| ' + ' | '.join(cell(c[1](x)) for c in cols) + ' |\n' for x in items)


def analyses_md(cat):
    allx = cat['analyses'] + cat['interventions']
    count = {}
    for x in allx:
        count[x['now']['level']] = count.get(x['now']['level'], 0) + 1
    out = ['# Analyses and interventions: what the current model can answer\n',
           '_Generated from `data/design_catalogue.json` by `tools/build_docs.py`. Edit the JSON, not this file._\n',
           '| Label | Meaning | Items |\n|---|---|---|']
    meaning = {'yes': 'Answered by the simulated sweep', 'partial': 'Exact method, limited by the data',
               'approx': 'Simple physics on existing results, labelled in the app',
               'no': 'Needs a new simulation or data (kept on the list)'}
    out += ['| %s | %s | %d |' % (LEVEL[k], meaning[k], count.get(k, 0)) for k in LEVEL]
    out.append('\nMechanisms live in `js/mechanisms.js` and show in the app under **Diagnose** and as extra metrics.\n')

    out.append('## Analyses\n')
    out.append(table(sorted(cat['analyses'], key=lambda x: x.get('priority', 9)), [
        ('Analysis', lambda x: '**%s**' % x['name']), ('Question', lambda x: x.get('question')),
        ('Now', lambda x: LEVEL[x['now']['level']]), ('Mechanism in the app', lambda x: x['now'].get('how')),
        ('Limits / what it needs', lambda x: x['now'].get('limits')), ('Full route', lambda x: HOW.get(x.get('how'))),
        ('Priority', lambda x: x.get('priority'))]))

    out.append('\n## Interventions\n')
    def rng(x):
        r = x.get('range')
        return '%s–%s %s' % (r[0], r[1], x.get('unit', '')) if r else None
    out.append(table(cat['interventions'], [
        ('Intervention', lambda x: '**%s**' % x['name']), ('Lever', lambda x: x.get('lever') and '`%s`' % x['lever']),
        ('Range', rng), ('Now', lambda x: LEVEL[x['now']['level']]), ('Mechanism in the app', lambda x: x['now'].get('how')),
        ('Limits', lambda x: x['now'].get('limits')),
        ('Cost / carbon rate', lambda x: 'not sourced' if x.get('cost_gbp_per_unit') is None else '%s £ / %s kg per %s' % (
            x['cost_gbp_per_unit'], x.get('carbon_kgco2e_per_unit'), x.get('unit_basis')))]))
    out.append('\nThe brief rules out moving louvres: `dynamic_external_shading` is listed for completeness only.\n')
    return '\n'.join(out)


def standalone(src):
    head, body = src.split('<main>', 1)
    return ('<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
            '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
            + head.strip() + '\n</head>\n<body>\n<main>' + body.rstrip() + '\n</body>\n</html>\n')


with open(os.path.join(ROOT, 'data', 'design_catalogue.json'), encoding='utf-8') as f:
    md = analyses_md(json.load(f))
with open(os.path.join(DOCS, 'ANALYSES.md'), 'w', encoding='utf-8') as f:
    f.write(md)
os.makedirs(os.path.join(DOCS, 'share'), exist_ok=True)
PAGES = ('heat-ledger.html', 'atrium-toolchain.html')
for name in PAGES:
    with open(os.path.join(DOCS, name), encoding='utf-8') as f:
        page = standalone(f.read())
    with open(os.path.join(DOCS, 'share', name), 'w', encoding='utf-8') as f:
        f.write(page)
print('wrote docs/ANALYSES.md and docs/share/' + ', docs/share/'.join(PAGES))
