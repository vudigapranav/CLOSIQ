"""Score fixed held-out records without fallback, with identical prompts for base and adapter."""
import argparse
import json
import os
from pathlib import Path
from examples import ROOT, inputs_for
from records import rows


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
    base = ROOT / "artifacts/base"
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
        try:
            parsed = json.loads(raw)
        except ValueError:
            parsed = None
        record = {"id": row["id"], "task": row["task"], "valid": False}
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
    args.output.write_text(json.dumps({"adapter":str(args.adapter) if args.adapter else None, "metrics":rates, "examples":results},indent=2))


if __name__ == "__main__":
    main()
