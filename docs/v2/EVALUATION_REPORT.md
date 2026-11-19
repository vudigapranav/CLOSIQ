# Evaluation status

The base model, candidate adapter and mobile conversion have no measured held-out scores in this checkout. The Python evaluation command emits per-example decisions and numerators/denominators for raw JSON validity, category, primary colour and outfit choice. Measure fallback-assisted validity separately. The 90% category and colour, 99% structured validity and 95% owned-item targets remain targets.

Host regression tests exercise the existing deterministic engine, invalid outfit selections and validation boundaries. They establish software behavior on test cases. They do not measure fashion accuracy, visual quality, Android memory, phone latency or success in airplane mode. Complete the [device protocol](TESTING.md) before publishing performance claims.
