import argparse
import hashlib
from pathlib import Path
from records import ROOT, rows, write_rows


def split(source, destination, seed):
    parts = {"train": [], "validation": [], "test": []}
    for row in rows(source):
        # Stable under future additions. All views of one garment/outfit family stay together.
        digest = hashlib.sha256(f"{seed}:{row['group']}".encode()).digest()
        bucket = int.from_bytes(digest[:8], "big") % 100
        name = "train" if bucket < 80 else "validation" if bucket < 90 else "test"
        parts[name].append(row)
    if not all(parts.values()):
        raise ValueError("At least one partition is empty. Add more independent groups.")
    if destination.exists() and any(destination.glob("*.jsonl")):
        raise ValueError("Choose a new split directory to preserve the previous held-out set.")
    for name, records in parts.items():
        write_rows(destination / (name + ".jsonl"), records)
    return {key: len(value) for key, value in parts.items()}


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--input", type=Path, default=ROOT / "data/processed/examples.jsonl")
    p.add_argument("--out", type=Path, default=ROOT / "data/splits")
    p.add_argument("--seed", type=int, default=42)
    args = p.parse_args()
    print(split(args.input, args.out, args.seed))
