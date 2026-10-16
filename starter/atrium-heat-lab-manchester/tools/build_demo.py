"""
Build demo/index.html: the same page with css/ and js/ inlined, for hosts that only
accept a single HTML file (the published demo link). data/*.json stay as separate files.

    python tools/build_demo.py

You do NOT need this to work on the app locally - just serve the folder:
    python -m http.server 8000      then open http://localhost:8000
"""
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def read(rel):
    with open(os.path.join(ROOT, rel), encoding='utf-8') as f:
        return f.read()


html = read('index.html')
body = html.split('<!--BUILD:STRIP-START-->')[1].split('<!--BUILD:STRIP-END-->')[0]
body = re.sub(r'<link rel="stylesheet" href="(css/[^"]+)">',
              lambda m: '<style>\n' + read(m.group(1)) + '\n</style>', body)
body = re.sub(r'<script src="(js/[^"]+)"></script>',
              lambda m: '<script>\n' + read(m.group(1)) + '\n</script>', body)
# the host supplies <html>/<head>/<body>; drop the closing head/opening body tags
body = body.replace('</head>', '').replace('<body>', '')
os.makedirs(os.path.join(ROOT, 'demo'), exist_ok=True)
with open(os.path.join(ROOT, 'demo', 'index.html'), 'w', encoding='utf-8') as f:
    f.write(body.strip() + '\n')
print('wrote demo/index.html ({:.0f} KB)'.format(len(body) / 1024))
