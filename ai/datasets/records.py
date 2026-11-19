"""CLOSIQ SFT v1 data contract. All image paths are relative to ai/data/images."""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
IMAGE_ROOT = ROOT / "data/images"
LICENSES = {"CC0-1.0", "CC-BY-4.0", "owned-with-training-rights", "project-authored-synthetic"}
CATEGORIES = {"tops", "bottoms", "outerwear", "shoes", "accessories"}
FORMALITIES = {"casual", "smart_casual", "formal", "evening"}


def rows(file):
    with file.open() as stream:
        for number, line in enumerate(stream, 1):
            if line.strip():
                try:
                    yield json.loads(line)
                except ValueError as exc:
                    raise ValueError(f"{file}:{number}: invalid JSON") from exc


def write_rows(file, records):
    file.parent.mkdir(parents=True, exist_ok=True)
    temp = file.with_suffix(".tmp")
    with temp.open("w") as stream:
        for record in records:
            stream.write(json.dumps(record, ensure_ascii=False) + "\n")
    temp.replace(file)


def verify(row, images=IMAGE_ROOT):
    required = ("id", "group", "source", "attribution", "rights_evidence", "prompt")
    if not all(isinstance(row.get(k), str) and row[k].strip() for k in required):
        raise ValueError("Missing ID, provenance, group, rights evidence or prompt")
    if row.get("schema") != 1 or row.get("license") not in LICENSES:
        raise ValueError(f"{row['id']}: unsupported schema or unreviewed license")
    answer = row.get("answer")
    if not isinstance(answer, dict):
        raise ValueError("Expected a structured answer")
    if row.get("task") == "rank":
        candidates = row.get("candidates")
        choice = answer.get("choice")
        if (not isinstance(candidates, list) or not 1 <= len(candidates) <= 3 or
                type(choice) is not int or not 1 <= choice <= len(candidates) or
                not isinstance(answer.get("explanation"), str) or not answer["explanation"].strip()):
            raise ValueError("Invalid grounded outfit choice")
        inventory = row.get("wardrobe")
        if not isinstance(inventory, dict) or not all(isinstance(k, str) and isinstance(v, str) for k,v in inventory.items()):
            raise ValueError("Wardrobe must map IDs to descriptions")
        for outfit in candidates:
            if not isinstance(outfit, list) or not outfit or len(set(outfit)) != len(outfit) or not set(outfit) <= inventory.keys():
                raise ValueError("Unowned or duplicate garment ID")
        return None
    if row.get("task") != "garment" or answer.get("category") not in CATEGORIES or answer.get("formality") not in FORMALITIES:
        raise ValueError("Invalid garment task, category or formality")
    if not all(isinstance(answer.get(k), str) and answer[k].strip() for k in ("name", "primaryColor", "subcategory", "pattern")):
        raise ValueError("Missing garment label")
    image = (images / row["image"]).resolve()
    if not image.is_relative_to(images.resolve()) or not image.is_file():
        raise ValueError("Missing or external image")
    from PIL import Image, ImageOps
    with Image.open(image) as source:
        oriented = ImageOps.exif_transpose(source).convert("RGB")
        h = hashlib.sha256(str(oriented.size).encode())
        h.update(oriented.tobytes())
    return h.hexdigest()


def instruction(row):
    if row["task"] == "garment":
        return row["prompt"]
    return row["prompt"] + "\nWardrobe and numbered options: " + json.dumps(
        {"wardrobe": row["wardrobe"], "options": list(enumerate(row["candidates"], 1))}, ensure_ascii=False)
