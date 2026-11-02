# Local audit — 28 October 2026

Scope: the redesigned CodingBuddy website, API, course content, four book videos, and local installation. Source base `ce388fa` on `codex/codingbuddy-redesign`, with the audit fixes in the working tree. Nothing was pushed, uploaded, or deployed during this audit.

## Result

The local application passes the automated functional checks below. It is ready for the hosting team's code review. Production configuration and a controlled import of the new course content still need verification on their infrastructure; a Git push alone does not transfer a database.

| Check | Result |
| --- | --- |
| Frontend unit/regression tests | 223 passed, 23 files |
| Backend unit/regression tests | 432 passed, 47 files |
| Backend integration tests on native PostgreSQL 17 | 366 passed, 35 files |
| TypeScript, frontend and API | Passed |
| ESLint and backend lint | Passed, no remaining lint warnings |
| Optimized frontend build | Passed, Next 16.4.3 with webpack |
| API production build and Prisma generation | Passed |
| Production dependency advisory scan | Zero known advisories |
| All dependencies, including development tools | Zero known advisories |
| Frozen offline lockfile installation | Passed |
| HTTP and asset checks | 121 passed |
| Video request boundary/malformed cases | 12 passed |
| Responsive browser layouts | 36 passed: six pages × three widths × VI/EN; no horizontal overflow |
| Course example execution | Five paid project pipelines and four downloadable-example tests passed |
| Fresh database installation | All eight migrations applied; schema up to date |
| Repeatable demo seed | Seeded twice; expected counts in all eight checked tables, no duplicates |
| Seed safety guards | Demo seed refuses production; project seed refuses a database outside the isolated review target |

The 1,021 frontend/backend automated tests are separate from the additional HTTP, content, installation, and browser checks. The checked advisory database is a point-in-time scan, not a guarantee against unknown vulnerabilities.

## Defects fixed during the audit

1. **False contact-form error.** The API returns an empty successful HTTP 202. The browser client previously tried to parse it as JSON, displaying failure after the message had been accepted. Empty 202/204 responses now work, structured JSON errors remain intact, and HTML gateway failures become normal API errors. Four regression tests cover these cases. The rebuilt form visibly showed “Message sent” using the local demo mail driver. The success panel also now aligns to the top of its column, preventing its return link from stretching to the height of the neighboring QR panel.
2. **Public video request errors.** Next's static handler returned HTTP 500 for out-of-bounds and malformed byte ranges. The four known book files now return HTTP 416 for invalid byte selections. Valid requests, suffix requests, seeking, and full downloads remain available. Nineteen range-validation tests and the live HTTP matrix cover this.
3. **Book playback with a production streaming provider.** Enrolled book lessons previously went through whichever streaming driver was configured. Their bundled file identifiers would fail against Cloudflare. After the normal lesson-access check, the explicit four-file public allowlist now uses the website origin, including when the API is hosted separately. Other assets retain the protected streaming path. Seven regression cases cover the allowlist and rejected alternatives.
4. **Dependency advisories.** Updated Next, Express, Nodemailer, the HTML sanitizer, and vulnerable transitive runtime/build/test dependencies. The initial production scan reported four critical, six high, thirteen moderate, and five low advisories. Both final scans report zero.
5. Corrected stale About-page copy to describe the four available videos and five written paid courses; removed an unused import reported by lint.

## Functional and browser coverage

- Public homepage, catalog, About, Contact, workshop, login, signup, password recovery, terms, and privacy pages load. Removed Community navigation remains absent. The portrait and Zalo QR load.
- Catalog/API agree on ten projects: one free trial, three priced at 100,000 VND, three at 150,000 VND, and three at 200,000 VND. Five paid courses accept direct enrollment; four are upcoming. Price filters and retired/missing-course handling were checked.
- Guests cannot read paid lesson content or reach protected API/admin functions. The direct enrollment page shows the selected project and QR without starting an online transaction.
- Login failure, demo learner login/logout, learner dashboard, book player controls, playback speed, and QR enrollment-message copying were exercised in the browser.
- A disposable learner was granted all five available paid courses through the administrator API. All fifteen written lessons were read, completed, and unmarked successfully. Paid lesson rendering and the completion toggle were also checked in the browser.
- Administrator overview, courses, categories, users, enrollments, orders, and audit-log screens loaded. Detailed role/access, instructor ownership, course publishing, enrollment, and revocation checks are covered by the integration suite.
- The final responsive matrix checked homepage, catalog, workshop, About, Contact, and direct enrollment at 360, 768, and 1280 pixels in both languages. Each page's identifying content was awaited before measuring. Mobile navigation opened and exposed the expected links. The temporary browser viewport override was reset afterward.
- All four actual MP4 files were downloaded through the local website and matched the SHA-256 values in `content/book-videos.json`. Each decoded at 1920×1080 and advanced during browser playback without a media error. This checks delivery/decoding, not the educational accuracy of every spoken minute.
- The integration suite covers registration, verification, login, recovery, password changes, sessions, CSRF, rate limits, blocked users, role boundaries, course ownership, signed resources, video authorization, learning progress, enrollment, and legacy payment callback/refund/race/failure behavior. External providers use test doubles; no real payment was made.

## Installation and environment findings

Integration tests ran against a new disposable native PostgreSQL cluster on port 5432, separate from the review database on 55435. A second disposable database verified clean migration and seed behavior. No production database was accessed.

Windows initially created a non-Unicode test database, then an ASCII-only case-folding locale. The first prevented Vietnamese fixture inserts; the second caused one Vietnamese case-insensitive search test to fail. Recreating only the disposable databases with UTF-8 and builtin `C.UTF-8` resolved both. The final integration suite passed. The hosting database must support UTF-8 and appropriate Vietnamese case handling.

Framework package downloads repeatedly timed out. The official archive was downloaded in byte ranges, verified against the registry's SHA-512 integrity value, and temporarily served locally to complete installation. No package source was altered. The final lockfile contains no temporary registry address, and normal frozen offline installation succeeds.

## Hosting handoff requirements

1. Push a review branch to the team's original repository when the owner requests it. Preserve their default branch/history; the portfolio repository remains independent.
2. Agree on the target runtime, start commands, reverse proxy, HTTPS, database backup, and environment values. Set `WEB_ORIGIN` to the public website, and configure the actual API address, cookie/signing secrets, trusted proxy headers, and production drivers. Local `.env` files are excluded from Git.
3. Import the ten-course catalog, five written course curricula, prices, availability, four book-video asset references, and resources into their database through a controlled, backed-up process. `prisma migrate deploy` handles schema only. **Do not run the demo seed on production.** `seed-project-courses.ts` intentionally refuses anything except the isolated review database and archives other published courses there; it is not a production import tool.
4. Include `apps/web/public/videos/books/`, the QR, portrait, fonts, and public downloads in the deployed website. The four MP4s total 207,046,764 bytes and each is below GitHub's 100 MB per-file limit. Verify static byte-range delivery through the actual host/proxy.
5. Configure real SMTP for contact messages, verification, and password recovery. The successful local contact test used the demo mail driver. Verify actual Zalo scanning and access-grant operations on staging.
6. Repeat a short staging smoke test before switching the domain: guest workshop video, signup/verification, direct enrollment QR, administrator access grant, paid lesson/progress, contact, recovery email, and phone layout.

## Limits and non-blocking content work

- Local Chromium browser checks do not substitute for physical iPhone/Android, Safari/Firefox, or slow/mobile network tests. Production capacity, CDN caching, backup restoration, and live provider credentials were not exercised.
- The repository's standalone Playwright E2E runner was not run; browser flows were exercised through the connected browser, alongside the complete API integration suite.
- VI/EN changes the main interface. Lesson prose/audio and parts of the inherited staff/player interface remain Vietnamese. Captions are not yet available. Some lesson Markdown repeats its title as a second H1; this is a semantic cleanup opportunity.
- The five paid courses currently deliver written first versions. Their longer project descriptions include intended later extensions; the owner should review the teaching scope and wording before publicly promoting them.
- No production email, payment, Zalo conversation, or remote deployment was initiated. No recording kits, transfer bundles, local databases, real `.env` files, audit credentials, or raw audit logs were added to Git.

## Repeat the checks

Run from the repository root using the locked Node/pnpm versions. API integration tests use `apps/api/.env.test` and modify their database; that file must point only to a disposable test database.

```powershell
pnpm install --frozen-lockfile
pnpm --filter web test
pnpm --filter api test
pnpm --filter web typecheck
pnpm --filter api typecheck
pnpm --filter web lint
pnpm --filter api lint
pnpm --filter api test:e2e
pnpm --filter api build
pnpm --filter web exec next build --webpack
pnpm audit --prod
pnpm audit
python scripts/check-paid-projects.py
python scripts/check-project-examples.py
```

Detailed local logs and disposable fixtures are in ignored `.codex-tmp/`. Contact-form browser evidence: [success screenshot](screenshots/audit-contact-success-2026-10-28.png).
