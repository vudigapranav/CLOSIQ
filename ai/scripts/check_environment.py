"""Inspect the active Python environment without fetching packages or weights."""
import json
import os
import platform
import shutil
import sys
from importlib import metadata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONFIG = json.loads((ROOT / "configs/base-model.yaml").read_text())


def version(name):
    try:
        return metadata.version(name)
    except metadata.PackageNotFoundError:
        return None


if __name__ == "__main__":
    mac = platform.system() == "Darwin"
    pages = os.sysconf("SC_PHYS_PAGES") if mac else 0
    mem = pages * os.sysconf("SC_PAGE_SIZE") if pages > 0 else None
    deps = {name: version(name) for name in ("mlx", "mlx-vlm", "torch", "torchvision", "transformers", "Pillow", "numpy", "huggingface-hub", "peft")}
    model = ROOT / CONFIG["directory"]
    print(json.dumps({
        "macos": platform.mac_ver()[0], "python": sys.version.split()[0],
        "apple_silicon": mac and platform.machine() == "arm64",
        "unified_memory_bytes": mem,
        "free_disk_bytes": shutil.disk_usage(ROOT).free, "packages": deps,
        "model": CONFIG["model"], "weight_files_present": any(model.glob("*.safetensors")),
        "training_compatibility": "requires a base inference and training smoke test"
    }, indent=2))
