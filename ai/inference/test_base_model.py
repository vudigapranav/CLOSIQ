"""Offline single-image benchmark on Apple Silicon. Run from any directory."""
import argparse
import json
import os
import resource
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def run(photo, directory, device, prompt):
    if not photo.is_file():
        raise ValueError(f"Photo does not exist: {photo}")
    if not directory.is_dir():
        raise ValueError(f"Missing local model at {directory}. Run ai/scripts/download_base.py first.")
    os.environ["HF_HUB_OFFLINE"] = "1"
    from PIL import Image, ImageOps
    import torch
    from transformers import AutoProcessor, SmolVLMForConditionalGeneration
    with Image.open(photo) as source:
        image = ImageOps.exif_transpose(source).convert("RGB")
    if device == "mps" and not torch.backends.mps.is_available():
        raise ValueError("MPS unavailable. Select --device cpu to benchmark CPU explicitly.")
    start = time.perf_counter()
    processor = AutoProcessor.from_pretrained(directory, local_files_only=True)
    dtype = torch.float32 if device == "cpu" else torch.float16
    model = SmolVLMForConditionalGeneration.from_pretrained(
        directory, torch_dtype=dtype, attn_implementation="eager", local_files_only=True
    ).to(device).eval()
    if device == "mps":
        torch.mps.synchronize()
    loaded = time.perf_counter()
    messages = [{"role": "user", "content": [{"type": "image"}, {"type": "text", "text": prompt}]}]
    template = processor.apply_chat_template(messages, add_generation_prompt=True, tokenize=False)
    inputs = processor(text=template, images=[image], return_tensors="pt").to(device, dtype)
    config = json.loads((ROOT / "configs/base-model.yaml").read_text())
    with torch.inference_mode():
        tokens = model.generate(**inputs, max_new_tokens=config["max_new_tokens"], do_sample=False)
    answer = processor.decode(tokens[0, inputs["input_ids"].shape[1]:], skip_special_tokens=True).strip()
    if not answer:
        raise ValueError("The model generated an empty answer.")
    peak = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    return {"description": answer, "device": device, "init_seconds": loaded - start,
            "inference_seconds": time.perf_counter() - loaded,
            "peak_process_rss_bytes": peak if sys.platform == "darwin" else peak * 1024}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("photo", type=Path)
    parser.add_argument("--model-dir", type=Path, default=ROOT / "artifacts/base")
    parser.add_argument("--device", choices=["cpu", "mps"], default="mps")
    parser.add_argument("--prompt", default="Describe this garment, its primary color and visible pattern. Say unknown if unclear.")
    args = parser.parse_args()
    try:
        print(json.dumps(run(args.photo, args.model_dir, args.device, args.prompt), indent=2))
    except (OSError, ImportError, RuntimeError, ValueError) as error:
        parser.exit(1, f"{error}\n")
