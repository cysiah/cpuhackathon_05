"""Critical statistics on the organisers' sweep. Prints numbers quoted in docs/CRITIQUE.md.

    python3 tools/critique_stats.py [path/to/atrium-heat-lab-manchester]
"""
import json, math, os, sys
import numpy as np
SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "starter", "atrium-heat-lab-manchester")
sw = json.load(open(os.path.join(SRC, "data", "sweep.json")))
cl = json.load(open(os.path.join(SRC, "data", "climate.json")))
G = sw["grid"]; wk0 = cl["hot_week"]["start_hoy"]
occ = [d * 24 + h for d in range(7) for h in range(8, 18)]
fut = cl["dry_bulb"]["future"]
dm = [sum(fut[d*24:(d+1)*24])/24 for d in range(365)]; trm = [dm[0]]
for d in range(1, 365): trm.append(0.2*dm[d-1] + 0.8*trm[d-1])
out = [fut[wk0+h] for h in range(168)]
def tm52(op, cat=3):
    he = 0; we = [0]*7; dmax = -99
    for h in occ:
        d = h // 24
        dT = round(op[h] - (0.33*trm[wk0//24 + d] + 18.8 + cat))
        if dT >= 1: he += 1
        if dT > 0: we[d] += dT
        dmax = max(dmax, dT)
    return [he <= 0.03*70, max(we) <= 6, dmax <= 4]
def df(d):
    tv = min(0.85, 1.3*d["g"]); return tv*(1-d["screen_opacity"])*1351*0.75*180*0.8/(4750*(1-0.25))
sc = np.array([r["score"] for r in G]); n = len(G)
print("designs", n, "pass<=42:", int((sc <= 42).sum()), "pass<=150:", int((sc <= 150).sum()))
p = [r for r in G if r["score"] <= 42]
print("pass with DF>=5%:", sum(df(r) >= 5 for r in p), " DF>=10%:", sum(df(r) >= 10 for r in p), " no screen:", sum(r["screen_opacity"] == 0 for r in p))
print("pass with g>=0.5 AND no screen:", sum(r["g"] >= 0.5 and r["screen_opacity"] == 0 for r in p))
f = [sum(1 for ok in tm52(r["operative"]) if not ok) for r in G]
print("TM52 fails: 0 ->", f.count(0), " <=1 ->", sum(x <= 1 for x in f), " 3 ->", f.count(3))
both = sum(1 for r, x in zip(G, f) if r["score"] <= 42 and x <= 1)
print("pass score AND pass TM52 (<=1 fail):", both)
ex = sum(1 for r, x in zip(G, f) if r["score"] <= 42 and x >= 2)
print("pass score but FAIL TM52 (>=2 fails):", ex, "of", len(p))
# outdoor air
print("outdoor-air score:", round(sum(max(0, out[h]-26) for h in occ), 1))
# score floor of the whole sweep
print("lowest score in sweep:", round(float(sc.min()), 1), " design:", min(G, key=lambda r: r["score"])["idx"])
# interpolation error vs score level
V = sw["validation"]
levs = sw["levers"]; K = list(levs)
idx = {k: {v: i for i, v in enumerate(levs[k])} for k in K}
SC = sc.reshape([len(levs[k]) for k in K])
def pred(d):
    br = []
    for k in K:
        L = levs[k]; v = d[k]
        if v <= L[0]: br.append((0, 0, 0.0)); continue
        if v >= L[-1]: br.append((len(L)-1, len(L)-1, 0.0)); continue
        j = max(i for i in range(len(L)) if L[i] <= v and i < len(L)-1)
        br.append((j, j+1, (v-L[j])/(L[j+1]-L[j])))
    s = 0
    for mask in range(32):
        w = 1; ix = []
        for i, (j0, j1, t) in enumerate(br):
            hi = (mask >> i) & 1; w *= t if hi else 1-t; ix.append(j1 if hi else j0)
        if w > 1e-12: s += w * SC[tuple(ix)]
    return s
err = [(pred(r)-r["score"], r["score"]) for r in V]
print("interpolation rmse", round(math.sqrt(sum(e*e for e, _ in err)/len(err)), 2), "max", round(max(abs(e) for e, _ in err), 1))
low = [abs(e) for e, s in err if s <= 100]; hi = [abs(e) for e, s in err if s > 100]
print("abs err for off-grid designs scoring <=100:", round(float(np.mean(low)), 1), "(n=%d)" % len(low), " >100:", round(float(np.mean(hi)), 1), "(n=%d)" % len(hi))
near = [(e, s) for e, s in err if 20 <= s <= 80]
print("off-grid designs scoring 20-80 K.h: n=%d, mean abs err %.1f, worst %.1f" % (len(near), np.mean([abs(e) for e, _ in near]), max(abs(e) for e, _ in near)))
# main effects: score range when varying one lever with others at baseline
base = dict(g=0.6, u=2.8, ach_day=4, ach_night=1, screen_opacity=0)
for k in K:
    vals = []
    for v in levs[k]:
        d = dict(base); d[k] = v
        vals.append(next(r["score"] for r in G if all(abs(r[a]-d[a]) < 1e-9 for a in K)))
    print("%-15s" % k, [round(x) for x in vals])
# interaction: U-value effect with and without screen
def get(**kw):
    d = dict(base); d.update(kw); return next(r["score"] for r in G if all(abs(r[a]-d[a]) < 1e-9 for a in K))
print("U 5.8 -> 1.0: unscreened", round(get(u=5.8)-get(u=1.0), 1), " behind 90% screen", round(get(u=5.8, screen_opacity=0.9)-get(u=1.0, screen_opacity=0.9), 1))
# operative vs air in baseline
b = json.load(open(os.path.join(SRC, "data", "baseline.json")))["eplus"]
print("baseline score from AIR temp:", round(sum(max(0, b["air"][h]-26) for h in occ), 1), " from operative:", round(sum(max(0, b["operative"][h]-26) for h in occ), 1))
print("baseline max operative - air:", round(max(o-a for o, a in zip(b["operative"], b["air"])), 1))
print("hours in sweep op series:", len(G[0]["operative"]))
