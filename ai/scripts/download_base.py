"""Download only the specified upstream revision into the ignored local artifact directory."""
from check_environment import CONFIG, ROOT


def main():
    from huggingface_hub import snapshot_download
    snapshot_download(CONFIG["model"], revision=CONFIG["revision"], local_dir=ROOT / CONFIG["directory"],
                      allow_patterns=["*.json", "*.safetensors", "*.model", "*.txt", "LICENSE*", "README.md"])


if __name__ == "__main__":
    main()
