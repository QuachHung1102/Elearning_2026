"""Execute the code taught by each open paid project, using its lesson fixtures."""
import ast
import json
import re
import tempfile
from pathlib import Path

root = Path(__file__).resolve().parents[1]
courses = json.loads((root / "apps/web/src/content/project-courses.json").read_text(encoding="utf-8"))
for course in courses:
    if course["publicTrial"] or course["availability"] != "available":
        continue
    lessons = [(root / "content/project-lessons" / lesson["file"]).read_text(encoding="utf-8") for lesson in course["lessons"]]
    code = "\n".join(re.search(r"```python\n(.*?)```", lesson, re.S).group(1) for lesson in lessons)
    sample = re.search(r"```csv\n(.*?)```", lessons[0], re.S).group(1)
    expected = ast.literal_eval(re.search(r"```text\n(.*?)```", lessons[1], re.S).group(1))
    namespace = {"__name__": "lesson_check"}
    exec(compile(code, course["slug"], "exec"), namespace)
    with tempfile.TemporaryDirectory() as folder:
        data = Path(folder) / "data.csv"
        data.write_text(sample, encoding="utf-8")
        rows, errors = namespace["load_rows"](data)
        assert not errors, errors
        result = namespace["analyse"](rows)
        assert result == expected, (course["slug"], result)
        report = Path(folder) / "report.html"
        namespace["write_report"](result, errors, report)
        assert "<table>" in report.read_text(encoding="utf-8")
        data.write_text(sample + sample.splitlines()[1] + "\n", encoding="utf-8")
        duplicate_rows, duplicate_errors = namespace["load_rows"](data)
        assert len(duplicate_rows) == len(rows) and len(duplicate_errors) == 1
        namespace["analyse"]([])
    print("PASS", course["slug"])
