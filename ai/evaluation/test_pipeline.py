"""Temporary images and synthetic metadata are test fixtures only."""
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "datasets"))
import records
import prepare_dataset
import split_dataset
import validate_dataset


class DatasetTests(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.root = Path(temp.name)
        self.rows = []
        for i in range(60):
            image = f"{i}.png"
            Image.new("RGB", (4, 4), (i, 0, 0)).save(self.root / image)
            self.rows.append(dict(id=str(i), group=f"g{i}", source="unit test", attribution="unit test",
                rights_evidence="generated during test", license="owned-with-training-rights", schema=1,
                task="garment", image=image, prompt="describe", answer=dict(name="test top",category="tops",
                    primaryColor="unknown",subcategory="unknown",pattern="unknown",formality="casual")))
        for module in [prepare_dataset, validate_dataset]:
            ctx = patch.object(module, "verify", lambda row: records.verify(row, self.root))
            ctx.start()
            self.addCleanup(ctx.stop)

    def test_round_trip(self):
        raw, ready, parts = self.root / "raw", self.root / "ready", self.root / "parts"
        records.write_rows(raw, self.rows + [{**self.rows[1], "id": "alias"}])
        self.assertEqual(prepare_dataset.prepare(raw, ready), 60)
        counts = split_dataset.split(ready, parts, 42)
        self.assertEqual(counts, validate_dataset.validate(parts))
        with self.assertRaises(ValueError):
            split_dataset.split(ready, parts, 42)
        # Copying one example into test must fail even under a new example ID.
        leaked = next(records.rows(parts / "train.jsonl"))
        with (parts / "test.jsonl").open("a") as file:
            file.write(json.dumps({**leaked, "id": "leak"})+"\n")
        with self.assertRaises(ValueError):
            validate_dataset.validate(parts)

    def test_provenance_and_paths(self):
        for patch in [dict(license="research only"), dict(image="../outside.png"), dict(rights_evidence="")]:
            with self.assertRaises(ValueError):
                records.verify({**self.rows[0], **patch}, self.root)

    def test_reward_cannot_include_unowned_garment(self):
        row = {**self.rows[0], "task": "rank", "wardrobe": {"tee":"Blue tee"}, "candidates":[["fake"]],
               "answer":{"choice":1,"explanation":"casual"}}
        with self.assertRaises(ValueError):
            records.verify(row,self.root)
        self.assertIsNone(records.verify({**row,"candidates":[["tee"]]},self.root))


if __name__ == "__main__":
    unittest.main()
