"""Create a single supervised example, masking image and user prompt tokens."""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "datasets"))
from records import IMAGE_ROOT, instruction


def inputs_for(row, processor, supervised):
    import json
    from PIL import Image, ImageOps
    image = None
    content = []
    if row["task"] == "garment":
        with Image.open(IMAGE_ROOT / row["image"]) as photo:
            image = ImageOps.exif_transpose(photo).convert("RGB")
        content.append({"type": "image"})
    content.append({"type": "text", "text": instruction(row)})
    turns = [{"role": "user", "content": content}]
    def encode(turns, generate):
        rendered = processor.apply_chat_template(turns, tokenize=False, add_generation_prompt=generate)
        return processor(text=rendered, images=[image] if image is not None else None, return_tensors="pt")
    prefix = encode(turns, True)
    if not supervised:
        return prefix
    answer = json.dumps(row["answer"], ensure_ascii=False)
    full = encode(turns + [{"role": "assistant", "content": [{"type": "text", "text": answer}]}], False)
    length = prefix["input_ids"].shape[1]
    if not full["input_ids"][:, :length].equal(prefix["input_ids"]) or length >= full["input_ids"].shape[1]:
        raise ValueError("Prompt prefix changed. Check processor/chat-template version.")
    labels = full["input_ids"].clone()
    labels[:, :length] = -100
    full["labels"] = labels
    return full
