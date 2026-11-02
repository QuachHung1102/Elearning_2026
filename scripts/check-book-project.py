"""Exercise the actual free-project bundle as a student would use it."""
import importlib.util
import json
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from zipfile import ZipFile

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "apps/web/public/downloads/projects"


class FreeBookProject(unittest.TestCase):
    def launch(self, path, inputs):
        result = subprocess.run([sys.executable, str(path)], input=inputs, text=True,
                                capture_output=True, timeout=10, cwd=path.parent)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stderr, "")
        return result.stdout

    def test_downloaded_bundle_can_borrow_restart_and_return(self):
        with tempfile.TemporaryDirectory() as folder, ZipFile(PUBLIC / "book-sharing-project.zip") as bundle:
            bundle.extractall(folder)
            project = Path(folder) / "book-sharing"
            program = project / "book-sharing.py"
            output = self.launch(program, "f\n\nb\n1\nq\n")
            self.assertIn("1 De Men Phieu Luu Ky", output)
            self.assertIn("3 A Brief History of Time", output)
            self.assertIn("Saved.", output)
            self.assertTrue(json.loads((project / "books.json").read_text())[0]["borrowed"])
            output = self.launch(program, "f\nde men\nr\n1\nf\nde men\nq\n")
            self.assertIn("No available books match.", output)
            self.assertIn("Saved.", output)
            self.assertIn("1 De Men Phieu Luu Ky", output)
            self.assertFalse(json.loads((project / "books.json").read_text())[0]["borrowed"])

    def test_bad_input_does_not_create_a_false_saved_state(self):
        with tempfile.TemporaryDirectory() as folder:
            program = Path(folder) / "book-sharing.py"
            shutil.copyfile(PUBLIC / program.name, program)
            output = self.launch(program, "b\nabc\nb\n99\nq\n")
            self.assertIn("Use a whole-number book ID.", output)
            self.assertIn("Unknown book", output)
            self.assertNotIn("Saved.", output)
            self.assertFalse((program.parent / "books.json").exists())

    def test_damaged_data_is_preserved(self):
        with tempfile.TemporaryDirectory() as folder:
            program = Path(folder) / "book-sharing.py"
            shutil.copyfile(PUBLIC / program.name, program)
            data = program.parent / "books.json"
            data.write_text("{not-valid-json", encoding="utf-8")
            self.assertIn("Could not read books.json", self.launch(program, "q\n"))
            self.assertEqual(data.read_text(), "{not-valid-json")

    def test_bundle_contains_only_the_named_free_material(self):
        names = ["book-sharing.py", "book-sharing-starter.py", "books.example.json",
                 "book-sharing-README.vi.md", "book-sharing-README.en.md", "book-sharing-TESTING.md"]
        expected = {"book-sharing/" + name for name in names}
        expected.update(f"book-sharing/lessons/books-0{i}.md" for i in range(1, 5))
        with ZipFile(PUBLIC / "book-sharing-project.zip") as bundle:
            self.assertEqual(set(bundle.namelist()), expected)
            for name in names:
                self.assertEqual(bundle.read("book-sharing/" + name), (PUBLIC / name).read_bytes())
            for i in range(1, 5):
                note = bundle.read(f"book-sharing/lessons/books-0{i}.md").decode("utf-8")
                original = (ROOT / f"content/project-lessons/books-0{i}.md").read_text(encoding="utf-8")
                if "/downloads/projects/book-sharing.py" in original:
                    self.assertIn("../book-sharing.py", note)
                self.assertNotIn("/downloads/projects/", note)
        web = json.loads((ROOT / "apps/web/src/content/book-project.json").read_text(encoding="utf-8"))
        self.assertEqual(web["source"], (PUBLIC / "book-sharing.py").read_text(encoding="utf-8"))
        self.assertEqual(len(web["lessons"]), 4)
        self.assertEqual(json.loads(web["sampleData"]), json.loads((PUBLIC / "books.example.json").read_text()))

    def test_starter_runs_but_marks_its_unfinished_functions(self):
        output = self.launch(PUBLIC / "book-sharing-starter.py", "")
        self.assertIn("Exercise scaffold", output)
        self.assertIn("1 De Men Phieu Luu Ky", output)
        spec = importlib.util.spec_from_file_location("book_starter", PUBLIC / "book-sharing-starter.py")
        starter = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(starter)
        with self.assertRaises(NotImplementedError):
            starter.find_available(starter.STARTER, "de men")


if __name__ == "__main__":
    unittest.main()
