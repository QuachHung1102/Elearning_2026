## Start the book-sharing project

Build a local Python tool to find available books, record borrowing and returns, and keep changes after closing the program. Each book has an ID, title and borrowing state. This version does not store borrower names, phone numbers or accounts.

The complete project is free: videos, written lessons, code and self-checks. The written material can be used without watching a video first.

The ZIP contains code, sample records and written lessons for offline use. The four videos remain on the website.

### 1. Prepare a workspace

- Use a computer with Python 3 and a text editor. No third-party packages are needed.
- You should be able to open a folder and run a Python file. Pause over small examples if functions, lists or dictionaries are new.
- Download and extract the ZIP into a new folder such as `codingbuddy-books`. Do not run the file from inside a ZIP preview.

| File | Purpose |
| --- | --- |
| `book-sharing.py` | The finished, runnable reference program |
| `book-sharing-starter.py` | An exercise scaffold with TODO functions, not a complete menu |
| `books.example.json` | Three sample books; not the program's working data file |
| `book-sharing-README.vi.md` / `book-sharing-README.en.md` | Vietnamese / English run instructions |
| `book-sharing-TESTING.md` | Manual checks and expected behavior |
| `lessons/` | Four Vietnamese written lessons in the ZIP for offline reading |

### 2. Check Python

Open Terminal or Command Prompt in the extracted folder:

```text
python --version
```

If Windows does not recognize `python`, try `py --version`. Some macOS/Linux computers use `python3 --version`. Use the working command for your computer below.

### 3. Run the finished example

```text
python book-sharing.py
```

Alternatives, depending on your setup:

```text
py book-sharing.py
python3 book-sharing.py
```

Choose one working command; you do not need to launch all three. At the menu, enter a letter and press Enter:

| Key | Action |
| --- | --- |
| `f` | Find available books by title; a blank keyword lists all available books |
| `b` | Borrow using a whole-number book ID |
| `r` | Return a book using its ID |
| `q` | Quit |

Initially, IDs `1` and `3` are available and ID `2` is borrowed. Try:

```text
[f]ind, [b]orrow, [r]eturn, [q]uit: f
Title keyword (blank = all available): de men
1 De Men Phieu Luu Ky
[f]ind, [b]orrow, [r]eturn, [q]uit: b
Book ID: 1
Saved.
```

Searching for `de men` again will not show the book while it is on loan. Enter `r`, then `1`, to return it and try the search again.

### 4. Understand saved data

After a borrow/return changes a state and saves successfully, the program writes `books.json` beside `book-sharing.py`. The next run loads that file. There is no separate save command, and searching does not create a data file.

`books.example.json` is a reference sample. You may copy it to `books.json` in a test folder before running, but do not overwrite data you want to keep. When no `books.json` exists, the program uses its built-in sample records.

If an existing data file is damaged, the program reports an error and stops instead of replacing it silently. Inspect the file or restore a valid backup. Copy the whole project folder before deliberately damaging sample data for a test.

### 5. Follow the four parts

1. **Book records:** run a small list and explain `id`, `title` and `borrowed`. A stable ID stays with the book when list order changes.
2. **Find, borrow, return:** inspect `find_available` and `set_loan`. Try absent titles and unknown IDs as well as successful actions.
3. **Save and reopen:** follow the conversion between Python records and JSON. Quit and reopen to confirm persistence rather than relying only on `Saved.`.
4. **Test and improve:** use `book-sharing-TESTING.md`, record actual results and explain one improvement.

Work on a copy when completing the TODO scaffold. Its unfinished functions deliberately raise `NotImplementedError`; that means an exercise remains to be implemented. Use `book-sharing.py` if you want to try the whole menu immediately.

### Troubleshooting

- **File not found:** check the terminal folder and make sure the filename did not become `book-sharing.py.txt`.
- **Python not recognized:** try `py` or `python3`; Python 3 must be installed.
- **Invalid ID:** enter `1`, not `1.0` or a book title, at `Book ID`.
- **Save failure:** use a test folder you can write to. A message saying the change is only in memory is not a successful save.
- **Accented search:** matching ignores letter case but does not remove Vietnamese accents automatically.

### Finish when

You can find → borrow → quit → reopen → return a book, explain the saved fields and record at least six checks. An optional next change could show the available count, add a genre or improve an error message.

This is a single-computer learning version without borrower verification, concurrent editing or automatic backups. Use sample books before proposing it for real classroom use.
