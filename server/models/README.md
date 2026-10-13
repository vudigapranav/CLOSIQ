# Studio-photo model

`u2netp.onnx` — the small U²-Net salient-object model, used by
`server/studioPhoto.js` to cut a garment out of a photo for the white
"studio" background.

* Source: rembg release assets, https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2netp.onnx
* Original model: U²-Net (Qin et al., 2020), https://github.com/xuebinqin/U-2-Net — **Apache License 2.0**
* SHA-256: `309c8469258dda742793dce0ebea8e6dd393174f89934733ecc8b14c76f4ddd8`
* Size: 4.6 MB, input 320×320, ~0.2–0.3 s per photo on one CPU core.

Chosen over `isnet-general-use` (178 MB, also Apache-2.0) on 2026-10-13: on a
busy test photo the larger model was only marginally cleaner, ~4× slower, and
too large to keep in git or ship in a Vercel function. To try it anyway,
download it here and set `STUDIO_MODEL=isnet-general-use`.
