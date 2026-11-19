"""Local-only LoRA pilot. Requires successful visual inspection of the unmodified base."""
import argparse
import hashlib
import json
import os
import platform
import resource
import sys
import time
from pathlib import Path
from examples import ROOT, inputs_for
from records import rows


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--config", type=Path, default=ROOT / "configs/fashion-lora.yaml")
    p.add_argument("--splits", type=Path, default=ROOT / "data/splits")
    p.add_argument("--out", type=Path, default=ROOT / "checkpoints/pilot")
    p.add_argument("--resume", action="store_true")
    p.add_argument("--smoke", action="store_true")
    p.add_argument("--base-result", type=Path, required=True, help="JSON output from the successful base photo benchmark")
    args = p.parse_args()
    result = json.loads(args.base_result.read_text())
    if not result.get("description") or result.get("inference_seconds", 0) <= 0:
        p.error("Run and inspect the base photo benchmark before training.")
    c = json.loads(args.config.read_text())
    base = json.loads((ROOT / "configs/base-model.yaml").read_text())
    train_file, val_file = (args.splits / (name + ".jsonl") for name in ("train", "validation"))
    train, val = list(rows(train_file)), list(rows(val_file))
    if not train or not val or {r["group"] for r in train} & {r["group"] for r in val}:
        p.error("Training and validation need independent, non-empty groups.")
    identity = {"base": base, "config": c, "smoke": args.smoke,
                "train_sha256": hashlib.sha256(train_file.read_bytes()).hexdigest(),
                "validation_sha256": hashlib.sha256(val_file.read_bytes()).hexdigest()}
    args.out.mkdir(parents=True, exist_ok=True)
    identity_path = args.out / "run.json"
    if args.resume:
        if json.loads(identity_path.read_text()) != identity:
            p.error("Resume requires the original run configuration and splits.")
    elif any(args.out.iterdir()):
        p.error("Use --resume or a fresh output directory.")
    os.environ["HF_HUB_OFFLINE"] = "1"
    import torch
    from peft import LoraConfig, get_peft_model
    from transformers import AutoProcessor, SmolVLMForConditionalGeneration, Trainer, TrainingArguments, set_seed
    from transformers.trainer_utils import get_last_checkpoint
    if not torch.backends.mps.is_available():
        p.error("Apple MPS is unavailable.")
    set_seed(c["seed"])
    processor = AutoProcessor.from_pretrained(ROOT / base["directory"], local_files_only=True)
    model = SmolVLMForConditionalGeneration.from_pretrained(ROOT / base["directory"], local_files_only=True,
                                                           torch_dtype=torch.float32, attn_implementation="eager")
    model = get_peft_model(model, LoraConfig(r=c["rank"], lora_alpha=c["alpha"], target_modules=c["target_modules"],
                                            lora_dropout=0.0, bias="none"))
    model.config.use_cache = False
    def collate(batch):
        if len(batch) != 1:
            raise ValueError("The pilot collator requires batch size one.")
        features = inputs_for(batch[0], processor, True)
        if features["input_ids"].shape[1] > c["max_tokens"]:
            raise ValueError("Example exceeds configured context limit.")
        return features
    interval = 1 if args.smoke else c["eval_steps"]
    training = TrainingArguments(output_dir=str(args.out), per_device_train_batch_size=c["batch_size"],
        per_device_eval_batch_size=1, gradient_accumulation_steps=c["accumulation"],
        max_steps=1 if args.smoke else c["steps"], learning_rate=c["learning_rate"],
        logging_steps=1, eval_strategy="steps", eval_steps=interval, save_strategy="steps", save_steps=interval,
        save_total_limit=2, load_best_model_at_end=True, metric_for_best_model="eval_loss", greater_is_better=False,
        remove_unused_columns=False, label_names=["labels"], dataloader_pin_memory=False, report_to=[],
        optim="adamw_torch", seed=c["seed"], data_seed=c["seed"])
    trainer = Trainer(model=model, args=training, train_dataset=train, eval_dataset=val[:1] if args.smoke else val, data_collator=collate)
    checkpoint = get_last_checkpoint(str(args.out)) if args.resume else None
    if args.resume and not checkpoint:
        p.error("No completed checkpoint to resume.")
    identity_path.write_text(json.dumps(identity, indent=2))
    start = time.perf_counter()
    report = trainer.train(resume_from_checkpoint=checkpoint)
    trainer.save_model(str(args.out / "best-adapter"))
    trainer.save_state()
    metrics = {**report.metrics, "seconds": time.perf_counter()-start, "base_revision": base["revision"],
               "train_examples": len(train), "validation_examples": len(trainer.eval_dataset),
               "peak_process_rss_bytes": resource.getrusage(resource.RUSAGE_SELF).ru_maxrss,
               "platform": platform.platform(), "history": trainer.state.log_history}
    (args.out / "training-report.json").write_text(json.dumps(metrics, indent=2))


if __name__ == "__main__":
    main()
