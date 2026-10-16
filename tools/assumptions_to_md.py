"""Rebuild ASSUMPTIONS.md from app/data/assumptions.json (the single source).

    python3 tools/assumptions_to_md.py
"""
import json
import os

ROOT = os.path.join(os.path.dirname(__file__), "..")
items = json.load(open(os.path.join(ROOT, "app", "data", "assumptions.json")))

lines = [
    "# Assumptions and placeholders",
    "",
    "Every guess the Floorplate Heat Map makes is listed here. The app shows the same list.",
    "",
    "**How to answer:** reply with the ID and your answer (e.g. `A04: 5F is at +17,500 mm, below the roof`).",
    "I'll update `app/data/assumptions.json`, mark the item answered, and change the code or data.",
    "",
    "Open: **%d** of %d" % (sum(1 for a in items if a["status"] != "answered"), len(items)),
    "",
]
group = None
for a in items:
    if a["group"] != group:
        group = a["group"]
        lines += ["", "## " + group, "", "| ID | What | Placeholder in use | Question for you | Status |", "|---|---|---|---|---|"]
    cells = [a["id"], a["what"], a["placeholder"], "**" + a["question"] + "**", a["status"]]
    lines.append("| " + " | ".join(c.replace("|", "/") for c in cells) + " |")
open(os.path.join(ROOT, "ASSUMPTIONS.md"), "w").write("\n".join(lines) + "\n")
print("wrote ASSUMPTIONS.md")
