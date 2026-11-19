import argparse
from pathlib import Path
from records import ROOT, rows, verify


def validate(directory):
    ids, groups, pixels, counts = set(), {}, {}, {}
    for part in ("train", "validation", "test"):
        count = 0
        for row in rows(directory / (part + ".jsonl")):
            digest = verify(row)
            if digest != row["pixel_sha256"] or row["id"] in ids:
                raise ValueError("Duplicate ID or image changed after preparation")
            ids.add(row["id"])
            if groups.setdefault(row["group"], part) != part or (digest and pixels.setdefault(digest, part) != part):
                raise ValueError("Leakage across dataset splits")
            count += 1
        if not count:
            raise ValueError("Empty partition")
        counts[part] = count
    return counts


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("directory", nargs="?", type=Path, default=ROOT / "data/splits")
    print(validate(p.parse_args().directory))
