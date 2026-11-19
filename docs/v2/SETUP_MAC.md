# Mac setup

Tested host tooling: macOS 27.0.1 arm64, 24 GiB physical memory, Node 25.4.0, Python 3.11.15, JDK 21 and Xcode 27. The native app needs Node 22.13 or newer. Run npm ci at the root and inside mobile. Set ANDROID_HOME to the installed Android SDK (typically ~/Library/Android/sdk), enable USB debugging on the test phone and authorize the Mac.

Use the [AI workspace instructions](../../ai/README.md) for a clean Python virtual environment. Use [Android deployment](MOBILE_DEPLOYMENT.md) for the APK. Initial package and weight downloads require network access. To run the shipped text-only seed through data preparation, Python's standard library is sufficient. Photograph preparation requires Pillow. Keep local images, downloaded models, checkpoints and evaluation outputs in the ignored paths under ai/.

The isolated checkout reuses the parent checkout's root node_modules for these host checks. Clean-install commands install ordinary dependency directories on another machine.
