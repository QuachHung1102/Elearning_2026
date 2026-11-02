"""Build the explicitly free book project's offline ZIP and web companion.

Only the four book lessons and the named public files below are included.
No paid lessons, recordings or production credentials are packaged.
"""
import importlib.util
import json
import re
import sys
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "apps/web/public/downloads/projects"
CONTENT = ROOT / "apps/web/src/content"
catalog = json.loads((CONTENT / "project-courses.json").read_text(encoding="utf-8"))
project = next(course for course in catalog if course["slug"] == "python-tu-sach-lop-minh")
if not project["publicTrial"] or project["priceVnd"] != 0:
    raise ValueError("The book companion can only package the free trial.")
if [lesson["file"] for lesson in project["lessons"]] != [f"books-0{i}.md" for i in range(1, 5)]:
    raise ValueError("Unexpected lesson outside the four public book lessons.")

spec = importlib.util.spec_from_file_location("book_reference", PUBLIC / "book-sharing.py")
reference = importlib.util.module_from_spec(spec)
spec.loader.exec_module(reference)
sample = json.dumps(reference.STARTER, ensure_ascii=False, indent=2) + "\n"
(PUBLIC / "books.example.json").write_text(sample, encoding="utf-8")

lesson_copy = [
    {
        "title": {"vi": "Bắt đầu từ một tủ sách nhỏ", "en": "Start with a small book shelf"},
        "description": {
            "vi": "Đọc cách lưu một cuốn sách bằng dictionary, ghép nhiều cuốn thành list và hiển thị trạng thái. Sau video, thử thêm một bản sách và giải thích vì sao mã cần ổn định.",
            "en": "Represent a book with a dictionary, collect records in a list and display borrowing states. Then add a sample book and explain why its identifier must stay stable.",
        },
    },
    {
        "title": {"vi": "Tìm sách, mượn và trả", "en": "Find, borrow and return"},
        "description": {
            "vi": "Viết các thao tác tìm theo tên và cập nhật trạng thái bằng mã. Bài đọc có ví dụ, bài tự làm và phần đối chiếu để bạn kiểm tra cả trường hợp không tìm thấy hoặc mượn lặp.",
            "en": "Search titles and update a loan by ID. The written lesson includes examples, practice and worked checks for missing items and repeated borrowing.",
        },
    },
    {
        "title": {"vi": "Lưu để hôm sau mở lại", "en": "Save the data for next time"},
        "description": {
            "vi": "Theo dõi cách dữ liệu Python được ghi thành JSON và đọc lại. Chạy chương trình hoàn chỉnh, mượn một cuốn, thoát rồi mở lại để kiểm tra trạng thái thực sự được lưu.",
            "en": "Follow data from Python records to JSON and back. Run the complete program, borrow a book, quit and reopen to check that the change really persisted.",
        },
    },
    {
        "title": {"vi": "Kiểm thử và sửa một điểm nhỏ", "en": "Test and improve one small thing"},
        "description": {
            "vi": "Dùng bảng kiểm thử, nhập sai có chủ đích trên bản sao và ghi kết quả thực tế. Chọn một cải tiến nhỏ, giải thích điều thay đổi và chạy lại những trường hợp đã đạt.",
            "en": "Use the test checklist, try invalid input on a copy and record actual results. Make one small improvement and repeat earlier checks to verify it.",
        },
    },
]

companion = {
    "source": (PUBLIC / "book-sharing.py").read_text(encoding="utf-8"),
    "sampleData": sample,
    "setup": {
        locale: re.sub(r"^(#{1,6}) ", lambda match: "#" * min(len(match[1]) + 1, 6) + " ",
                       (PUBLIC / f"book-sharing-README.{locale}.md").read_text(encoding="utf-8"), flags=re.M)
        for locale in ["vi", "en"]
    },
    "lessons": [],
}
archive = {
    name: (PUBLIC / name).read_bytes()
    for name in [
        "book-sharing.py", "book-sharing-starter.py", "books.example.json",
        "book-sharing-README.vi.md", "book-sharing-README.en.md", "book-sharing-TESTING.md",
    ]
}
for lesson, copy in zip(project["lessons"], lesson_copy):
    original = (ROOT / "content/project-lessons" / lesson["file"]).read_text(encoding="utf-8")
    # The page already supplies each lesson's H2. Keep the note hierarchy below it.
    notes = re.sub(r"\A# [^\n]+\n+", "", original)
    notes = re.sub(r"^(#{1,6}) ", lambda match: "#" * min(max(len(match[1]) + 1, 3), 6) + " ", notes, flags=re.M)
    companion["lessons"].append({**copy, "notes": notes})
    archive["lessons/" + lesson["file"]] = original.replace(
        "/downloads/projects/book-sharing.py", "../book-sharing.py"
    ).encode("utf-8")

destination = PUBLIC / "book-sharing-project.zip"
with ZipFile(destination, "w", compression=ZIP_DEFLATED) as bundle:
    for name, data in archive.items():
        # Fixed timestamps make rebuilding the same teaching material deterministic.
        entry = ZipInfo("book-sharing/" + name, date_time=(2026, 11, 1, 0, 0, 0))
        entry.compress_type = ZIP_DEFLATED
        entry.external_attr = 0o100644 << 16
        bundle.writestr(entry, data)
(CONTENT / "book-project.json").write_text(
    json.dumps(companion, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
)
print(f"Built {destination.name}: {len(archive)} files, {destination.stat().st_size} bytes")
print("Built the public web companion from the same free teaching material")
