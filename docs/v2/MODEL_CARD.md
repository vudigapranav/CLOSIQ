# Model identity and distribution

| Item | Current evidence |
| --- | --- |
| Development base | HuggingFaceTB/SmolVLM2-500M-Video-Instruct, pinned upstream revision abf83ca8a19096fcfa511aa8e7aaaefb02753f41. Hugging Face Smol Models Research team, Apache-2.0 per upstream model card. |
| Mac candidate | The MLX community publishes a conversion. The checked-in runner uses the upstream Transformers model and processor. |
| Mobile base | litert-community/SmolVLM2-500M, revision 307bf6d1018edd2c2d0903b92628151bdb5cc2b7, Apache-2.0 per distributor. Credits belong to the upstream authors and converter. |
| Publisher manifest | 363,085,824 bytes, SHA-256 7b432bbc0a5c54ba15ecb2f039a7711c1cfb1fe38badec01397a076b5043f74e. Verified on 2026-11-19 by streaming the revision-pinned file and hashing it on the development Mac: both values matched exactly. The phone still re-checks size and hash at install time. |
| Runtime | Kotlin LiteRT-LM on Android, one image per conversation. The app validates local file size and hash before installation. |
| CLOSIQ-VLM-500M | Reserved for a future fashion-adapted checkpoint. No trained weights, mobile export or performance claims. |

Garment recognition and outfit explanations may be wrong, particularly with small objects, cluttered backgrounds and unfamiliar garments. Users can correct attributes. Textile composition defaults to unknown. The outfit engine controls garment IDs.

The app fetches the original public base bundle on explicit request. No binaries or training photos are distributed in Git. Retain the upstream license, attribution and applicable notices before mirroring or redistributing weights.

[Base model and license](https://huggingface.co/HuggingFaceTB/SmolVLM2-500M-Video-Instruct) · [Mobile bundle and license](https://huggingface.co/litert-community/SmolVLM2-500M) · [File pointer](https://huggingface.co/litert-community/SmolVLM2-500M/raw/main/SmolVLM2-500M.litertlm)
