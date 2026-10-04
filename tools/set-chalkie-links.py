#!/usr/bin/env python3
"""Update chalkie-links.json (lesson number -> Chalkie URL) from a mapping file.

Lesson numbers run 1-108 (3 classes per week: week W, Day D = (W-1)*3 + D).
Sept/Oct 2026 = Weeks 1-8 = Lessons 1-24.

Usage:
  python3 tools/set-chalkie-links.py mapping.json            # merge into chalkie-links.json
  python3 tools/set-chalkie-links.py mapping.json --replace  # replace whole file with the mapping
  python3 tools/set-chalkie-links.py mapping.json --dry-run  # show changes, write nothing

mapping.json is {"1": "https://...", "2": "https://...", ...}. Keys may be ints or strings.
A null or empty URL removes that lesson's link. Only https:// URLs are accepted.
Lessons with no entry show no button on the site.
"""
import argparse, json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
TARGET = os.path.join(HERE, "..", "chalkie-links.json")
MAX_LESSON = 108


def load(path):
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, dict):
        sys.exit(f"{path}: expected a JSON object {{lessonNumber: url}}")
    return data


def clean(data, label):
    out = {}
    for k, v in data.items():
        try:
            n = int(str(k).strip())
        except ValueError:
            sys.exit(f"{label}: bad lesson number {k!r}")
        if not 1 <= n <= MAX_LESSON:
            sys.exit(f"{label}: lesson number {n} out of range 1-{MAX_LESSON}")
        v = "" if v is None else str(v).strip()
        if v and not v.lower().startswith("https://"):
            sys.exit(f"{label}: lesson {n}: URL must start with https:// (got {v!r})")
        out[n] = v
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("mapping", help="JSON file {lessonNumber: url}")
    ap.add_argument("--replace", action="store_true", help="replace the file instead of merging")
    ap.add_argument("--dry-run", action="store_true", help="print the result, do not write")
    ap.add_argument("--target", default=TARGET, help="JSON file to update (default: chalkie-links.json at repo root)")
    a = ap.parse_args()

    new = clean(load(a.mapping), a.mapping)
    cur = {} if a.replace or not os.path.exists(a.target) else clean(load(a.target), a.target)
    cur.update(new)
    final = {str(n): u for n, u in sorted(cur.items()) if u}
    text = json.dumps(final, indent=2, ensure_ascii=False) + "\n"
    if a.dry_run:
        sys.stdout.write(text)
        return
    with open(a.target, "w", encoding="utf-8") as f:
        f.write(text)
    print(f"Wrote {len(final)} link(s) to {os.path.normpath(a.target)}")


if __name__ == "__main__":
    main()
