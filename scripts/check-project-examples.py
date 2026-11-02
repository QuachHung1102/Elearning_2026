"""Check the actual downloadable teaching examples; no external dependencies."""
import importlib.util
from pathlib import Path
import tempfile
import unittest
import sys

sys.dont_write_bytecode = True

ROOT = Path(__file__).resolve().parents[1] / "apps/web/public/downloads/projects"


def load(name):
    spec = importlib.util.spec_from_file_location(name, ROOT / (name + ".py"))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


books = load("book-sharing")
waste = load("food-waste")


class ProjectExamples(unittest.TestCase):
    def test_search_and_loan_lifecycle(self):
        data = [entry.copy() for entry in books.STARTER]
        self.assertEqual(len(books.find_available(data, "DE MEN")), 1)
        self.assertTrue(books.set_loan(data, 1, True))
        self.assertEqual(books.find_available(data, "de men"), [])
        self.assertFalse(books.set_loan(data, 1, True))
        self.assertFalse(books.set_loan(data, 99, True))
        self.assertTrue(books.set_loan(data, 1, False))
        self.assertEqual(len(books.find_available(data, "de men")), 1)

    def test_saved_books_and_invalid_data(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "books.json"
            data = books.load_books(path)
            books.set_loan(data, 1, True)
            books.save_books(data, path)
            self.assertTrue(books.load_books(path)[0]["borrowed"])
            path.write_text('[{"id":1,"title":"A","borrowed":false},{"id":1,"title":"B","borrowed":false}]', encoding="utf-8")
            with self.assertRaises(ValueError):
                books.load_books(path)

    def test_documented_sample_output(self):
        totals, skipped = waste.read_totals(ROOT / "food-waste.csv")
        self.assertEqual(totals, {"Monday": 200, "Tuesday": 150, "Wednesday": 230})
        self.assertEqual(sum(totals.values()), 580)
        self.assertEqual(skipped, 0)

    def test_invalid_measurements_and_missing_headers(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "data.csv"
            path.write_text("day,item,grams\nMonday,rice,10\nMonday,rice,-10\nMonday,rice,unknown\nMonday,rice,nan\nMonday,rice,inf\nMonday,rice,\n", encoding="utf-8")
            self.assertEqual(waste.read_totals(path), ({"Monday": 10}, 5))
            path.write_text("day,item,weight\n", encoding="utf-8")
            with self.assertRaises(ValueError):
                waste.read_totals(path)
            path.write_text("day,item,grams\n", encoding="utf-8")
            self.assertEqual(waste.read_totals(path), ({}, 0))


if __name__ == "__main__":
    unittest.main()
