# Local model development

Run from the repository root on Apple Silicon with CPython 3.11. Package pins select the Transformers 4 SmolVLM implementation. Direct packages are pinned. Transitive resolution and the MPS path still require a connected clean-install verification.

```sh
python3.11 -m venv ai/.venv
source ai/.venv/bin/activate
python -m pip install -r ai/requirements.txt
python ai/scripts/check_environment.py
python ai/scripts/download_base.py
python ai/inference/test_base_model.py public/wardrobe/men/outerwear/washed_denim_jacket.webp
```

The download script is the only network step after installation. The benchmark loads a local directory and emits JSON with the actual answer, times and peak process RSS. Inspect the answer against the photo before training. Repeat on diverse photos including dresses, shoes, traditional clothing, occlusion and uncertain colours. The model's processor supplies the image normalization and chat template. The MLX community conversion is an alternative for a future benchmark. Exact-architecture MLX LoRA remains unverified.

Base and mobile model licenses and limitations are recorded in [the model card](../docs/v2/MODEL_CARD.md).
