# Free book project: written companion and code

The public `/workshop` page now provides a complete written route through the free book-sharing project alongside its four videos. No upload or deployment was performed.

## Visible on the page

- A project description, practical use case and deliverables.
- A short setup/run guide with the exact command and menu keys.
- Detailed bilingual instructions and troubleshooting, with a clear distinction between the working program and the exercise scaffold.
- The complete 90-line reference program, displayed directly in a keyboard-scrollable code block.
- A function-by-function explanation and an inspectable sample JSON file.
- Individual download links for the reference code, starter, sample data and test checklist.
- A project ZIP containing ten files, including all four written lessons for offline use. The videos remain on the website.
- A description for each video and all four written lessons expanded by default, including examples, exercises and worked checks.

The public course page also links to the ZIP and reference code. Other paid projects retain their existing access rules. Book lesson headings are nested beneath the page's single H1, and two stale references in the lesson notes were corrected to match the actual state-only program and four-part sequence.

## Files and regeneration

The reference program is `apps/web/public/downloads/projects/book-sharing.py`. The starter, README files, test checklist, example JSON and ZIP are in the same directory.

```powershell
python scripts/build-book-project.py
python scripts/check-book-project.py
python scripts/check-project-examples.py
```

The build script uses an explicit allowlist of the free book project and its four lessons. It produces a deterministic ZIP and `apps/web/src/content/book-project.json`, which the public page imports at build time. This keeps the displayed code, downloadable program, offline notes and web notes synchronized and removes the former runtime dependency on reading Markdown outside the frontend deployment folder. Rebuild these artifacts whenever the source, README or book lessons change.

The starter deliberately contains TODO functions; the complete program has the runnable menu. The sample `books.example.json` is separate from the working `books.json` so unzipping the bundle does not replace a learner's saved data.

## Verification

- 237 frontend tests passed, including both-language rendering, directly visible source, all four notes open by default and unchanged four-video coverage.
- Five dedicated Python checks passed: a real run from the extracted ZIP, borrow/restart/return persistence, invalid input, preservation of damaged data, the exact free-file allowlist, and runnable scaffold behavior. The bundle/consistency checks are grouped within those five tests.
- Four existing downloadable-example tests passed.
- Both language versions and all seven individual downloads passed HTTP checks, with downloaded bytes matching their source files.
- Six browser layout checks passed at 360px, 768px and 1280px in VI/EN, with no horizontal overflow, four open written lessons and one H1.
- Type checks, lint and the optimized production build passed.

The program is a single-user local learning example. It stores book IDs, titles and borrowing state, without borrower names, multi-user access or automatic backups.

[Source-code preview](screenshots/free-book-code-2026-11-01.png)
