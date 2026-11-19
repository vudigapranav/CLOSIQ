# Training the fashion pilot

First run the unmodified base model with an actual photo, save its JSON result and inspect the answer. Complete the Android test with the base model before expensive training. The training entry point requires a base result and a held-out split. Do not train the fashion pilot on the small text-only seed alone.

```sh
source ai/.venv/bin/activate
python -m pip install -r ai/training/requirements.txt
python ai/inference/test_base_model.py public/wardrobe/men/outerwear/washed_denim_jacket.webp > ai/benchmarks/results/base.json
python ai/datasets/prepare_dataset.py ai/data/private_manifest.jsonl
python ai/datasets/split_dataset.py --out ai/data/splits/pilot
python ai/datasets/validate_dataset.py ai/data/splits/pilot
python ai/training/train.py --smoke --out ai/checkpoints/smoke --splits ai/data/splits/pilot --base-result ai/benchmarks/results/base.json
python ai/training/train.py --out ai/checkpoints/pilot --splits ai/data/splits/pilot --base-result ai/benchmarks/results/base.json
python ai/training/evaluate_checkpoint.py --split ai/data/splits/pilot/test.jsonl --output ai/benchmarks/results/base-heldout.json
python ai/training/evaluate_checkpoint.py --split ai/data/splits/pilot/test.jsonl --adapter ai/checkpoints/pilot/best-adapter --output ai/benchmarks/results/adapter-heldout.json
```

The input contract is in [DATASET_CARD.md](../../ai/data/DATASET_CARD.md). The trainer masks all user and image tokens, freezes the base through PEFT and adapts the text attention query/value projections. The test split is excluded from optimization. The training and validation manifests and run configuration are fingerprinted. Use the same command with --resume after an interrupt to recover the most recent completed checkpoint. Validation loss determines the retained best adapter. Step history and peak process memory go in training-report.json.

PyTorch MPS is the candidate training path. Compatibility of this exact base, LoRA target pattern and pinned stack must be established by the smoke run. MLX inference support by itself does not establish MLX training support. Full-weight optimization requires a separate measured memory and quality comparison. There is no verified full-tuning configuration or trained adapter yet.
