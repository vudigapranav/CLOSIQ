# Android acceptance and regression

From the root run npm test, npm run test:server, npm run typecheck and npm run build. From mobile run npx tsc --noEmit, npm run check:release-env and npx expo export -p android. In the AI environment run python ai/evaluation/test_pipeline.py and python ai/datasets/validate_dataset.py on the chosen split.

| Device test | Evidence to record |
| --- | --- |
| Fresh guest launch without network | Setup completes, empty wardrobe is usable, no auth prompt. |
| Capture and import | Camera, gallery, denied permissions, preview, cancel, retry, editable labels and missing image. |
| Wardrobe and data | Both profile collections, search, filter, edit, delete, relaunch and side-by-side V1 app. |
| Stylist and planner | Real owned IDs, excluded/laundry garments, empty wardrobe, alternative, swap, save and event after restart. |
| Model lifecycle | First download, version, checksum mismatch, low disk, interruption, retry, replacement and confirmed deletion. |
| Inference | Same garment on CPU/GPU, multiple photos in fresh conversations, timeout, cancellation, background and memory pressure. Compare descriptions to visible features. |
| Offline privacy | Inspect connections with network logging, then disable mobile data and Wi-Fi, force-stop and relaunch. No fetch of a photo or prompt. Exercise every core screen. |
| Restore and V1 import | Local folder export with photos, merge into a fresh install, missing file rollback, denied storage access; optional account with two profiles, retry after network interruption and verify cloud rows unchanged. |
| Size and performance | Measure APK bytes, installed size before/after model, per-photo growth, initialization latency, inference latency and memory. Profile shows process PSS after a run on Android; obtain peak PSS over time with adb shell dumpsys meminfo com.closiq.app.v2. |

Use the release-style APK from [MOBILE_DEPLOYMENT.md](MOBILE_DEPLOYMENT.md). A Metro export or an emulator result cannot close the physical Android vision test. iPhone testing is outside the requested acceptance process.

Host-side runs close only the software gates: TypeScript, 170 mobile/shared tests, 16 server tests, the Android JS export, the arm64 APK build and model-artifact checksum verification. Everything in the table above needs the phone.
