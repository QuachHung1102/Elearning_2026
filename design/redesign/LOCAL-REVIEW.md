# Local review

The current review is available at http://localhost:5000 when the local processes are running. Nothing was pushed or deployed during the 28 October audit. See [the test report](TEST-REPORT-2026-10-28.md) for current verification results and hosting requirements; older preparation notes describe earlier versions.

## Current content

All ten course pages now have detailed Vietnamese/English public previews: project briefs, outcomes, expandable outlines, prerequisites, scenarios, thinking exercises, scope and course-specific FAQs. Full paid walkthroughs and solutions remain in the enrolled area. See [the 1 November content review](COURSE-PREVIEWS-2026-11-01.md).

- Ten practical Python projects: the free book-sharing trial and nine paid projects priced at 100,000, 150,000, or 200,000 VND.
- Five paid projects accept direct enrollment and contain three written lessons each. Four more projects are upcoming.
- `/workshop` contains all four actual book videos, expanded written notes, exercises, setup instructions, the complete code displayed on-page, and a downloadable ZIP with a working program, starter, sample data, run guides and test checklist. No account is required. `/trial/books` redirects there. See [the free project companion](FREE-BOOK-PROJECT-2026-11-01.md).
- Paid enrollment uses the owner's Zalo QR and a prepared course message. After agreeing enrollment directly, the administrator grants access through the existing admin tools.
- The About page contains Nam's portrait. The Community page/navigation and the homepage's three-step strip were removed at the owner's request.
- VI/EN controls the main interface. Audio, teaching prose, and some inherited staff/player text remain Vietnamese.

## Local accounts

Use `student1@elearning.local` with password `Demo!Student123` for the existing learner fixture. Use `admin@elearning.local` with password `Demo!Admin123` for local admin review. These are disposable demo accounts, not live-site credentials. Temporary audit users are disabled after testing.

## Restart

From the repository root, use separate terminals:

```powershell
node scripts/review-db.mjs
pnpm --filter api start:prod
pnpm --filter web start
```

The API uses the existing ignored `apps/api/.env`, and the frontend uses ignored `apps/web/.env.local`. They point only to localhost. The review database is stored under ignored `.local-review/` and listens at `127.0.0.1:55435`.

After source changes, stop the frontend before rebuilding its `.next` output:

```powershell
pnpm --filter api build
pnpm --filter web exec next build --webpack
```

Refresh project content only in the isolated review database:

```powershell
pnpm --filter api exec tsx prisma/seed-project-courses.ts
python scripts/check-paid-projects.py
python scripts/check-project-examples.py
```

The project seed refuses all targets except `127.0.0.1:55435/template1`. It archives other published courses in that review database. It must not be repurposed as a production migration/import command. A Git push does not copy this local database.

## External services

Local contact/verification/recovery messages use the demo mail driver. No real payment or SMTP provider is connected. The production team must configure real services, import the course data safely, include the static video/assets, and smoke-test staging before changing the live domain.
