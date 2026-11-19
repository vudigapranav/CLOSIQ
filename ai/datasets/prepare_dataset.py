import argparse
import json
from pathlib import Path
from records import rows, verify, write_rows, ROOT


def prepare(source, destination):
    out, ids, pixels, tasks = [], set(), {}, {}
    for row in rows(source):
        digest = verify(row)
        if row["id"] in ids:
            raise ValueError("Duplicate example ID: " + row["id"])
        ids.add(row["id"])
        key = json.dumps([digest, row["task"], row["prompt"], row.get("wardrobe"), row.get("candidates")], sort_keys=True)
        if key in tasks:
            if tasks[key] != row["answer"]:
                raise ValueError("Conflicting answers for the same input")
            continue
        if digest and digest in pixels and pixels[digest] != row["group"]:
            raise ValueError("Same image in two groups; reconcile provenance before splitting")
        if digest:
            pixels[digest] = row["group"]
        tasks[key] = row["answer"]
        out.append({**row, "pixel_sha256": digest})
    if not out:
        raise ValueError("No approved examples found")
    write_rows(destination, out)
    return len(out)


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("manifest", type=Path)
    p.add_argument("--out", type=Path, default=ROOT / "data/processed/examples.jsonl")
    args = p.parse_args()
    print("Prepared", prepare(args.manifest, args.out), "examples")
