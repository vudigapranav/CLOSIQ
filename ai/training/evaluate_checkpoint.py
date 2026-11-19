"""Score fixed held-out records without fallback, with identical prompts for base and adapter."""
import argparse
import hashlib
import json
import os
from pathlib import Path
from examples import ROOT, inputs_for
from records import rows


def first_json_object(text):
    """Same rule as the app (mobile/src/local/validation.ts firstJsonObject):
    the first balanced top-level object, so the score reflects what the phone
    would accept rather than penalising a code fence or a leading sentence."""
    start = text.find("{")
    if start < 0:
        return None
    depth, quoted, escaped = 0, False, False
    for i in range(start, len(text)):
        c = text[i]
        if quoted:
            if escaped:
                escaped = False
            elif c == "\\":
                escaped = True
            elif c == '"':
                quoted = False
        elif c == '"':
            quoted = True
        elif c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                return text[start:i + 1]
    return None


def parse_answer(raw):
    candidate = first_json_object(raw)
    if candidate is None:
        return None
    try:
        return json.loads(candidate)
    except ValueError:
        return None


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--adapter", type=Path)
    p.add_argument("--split", type=Path, default=ROOT / "data/splits/test.jsonl")
    p.add_argument("--output", type=Path, required=True)
    args = p.parse_args()
    dataset = list(rows(args.split))
    if not dataset:
        p.error("A held-out dataset is required.")
    os.environ["HF_HUB_OFFLINE"] = "1"
    import torch
    from transformers import SmolVLMForConditionalGeneration, AutoProcessor
    config = json.loads((ROOT / "configs/base-model.yaml").read_text())
    base = ROOT / config["directory"]
    processor = AutoProcessor.from_pretrained(base, local_files_only=True)
    model = SmolVLMForConditionalGeneration.from_pretrained(base, local_files_only=True,
            torch_dtype=torch.float16, attn_implementation="eager")
    if args.adapter:
        from peft import PeftModel
        model = PeftModel.from_pretrained(model, args.adapter, local_files_only=True)
    model.to("mps").eval()
    results = []
    for row in dataset:
        inputs = inputs_for(row, processor, False).to("mps", torch.float16)
        with torch.inference_mode():
            generated = model.generate(**inputs, do_sample=False, max_new_tokens=160)
        raw = processor.decode(generated[0, inputs["input_ids"].shape[1]:], skip_special_tokens=True)
        parsed = parse_answer(raw)
        record = {"id": row["id"], "task": row["task"], "valid": False, "raw": raw}
        if row["task"] == "garment":
            output = parsed if isinstance(parsed, dict) else {}
            record["category_correct"] = output.get("category") == row["answer"]["category"]
            record["color_correct"] = str(output.get("primaryColor","")).casefold() == row["answer"]["primaryColor"].casefold()
            record["valid"] = (output.get("category") in ["tops","bottoms","outerwear","shoes","accessories"] and
                               output.get("formality") in ["casual","smart_casual","formal","evening"] and
                               all(isinstance(output.get(k), str) and output[k].strip() for k in ("name","primaryColor")))
        else:
            choice = parsed.get("choice") if isinstance(parsed, dict) else None
            record["valid"] = (type(choice) is int and 1 <= choice <= len(row["candidates"]) and
                               set(parsed) == {"choice","explanation"} and isinstance(parsed["explanation"],str) and bool(parsed["explanation"].strip()))
            record["choice_correct"] = record["valid"] and choice == row["answer"]["choice"]
        results.append(record)
    rates = {}
    for metric in ["valid","category_correct","color_correct","choice_correct"]:
        scores = [r[metric] for r in results if metric in r]
        rates[metric] = {"correct": sum(scores), "total":len(scores)}
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps({"adapter":str(args.adapter) if args.adapter else None,
        "base_model": config["model"], "base_revision": config["revision"], "split": str(args.split),
        "split_sha256": hashlib.sha256(args.split.read_bytes()).hexdigest(),
        "metrics":rates, "examples":results},indent=2))


if __name__ == "__main__":
    main()
