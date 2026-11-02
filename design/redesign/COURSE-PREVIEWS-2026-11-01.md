# All-course public content — 1 November 2026

Expanded all ten course pages in Vietnamese and English for local review. Nothing was pushed or deployed.

Each course now has three introduction paragraphs, six learning outcomes, a specific project brief and use case, three deliverables, a detailed expandable outline, a public thinking exercise without a worked solution, prerequisites, audience guidance, current scope, optional later directions and three course-specific FAQs. The shared enrollment/language FAQs remain below them.

## Coverage

| Project | Public outline | Existing delivery |
| --- | --- | --- |
| Book-sharing tracker | Four parts: records, finding/borrowing, persistence, testing | Free; four videos, notes and source |
| Lost-and-found register | Four planned parts: records, filtering, verification, handover/export | Upcoming |
| Revision planner | Five planned parts: tasks, capacity, allocation, rescheduling, export | Upcoming |
| Folder organizer | Five planned parts: inspection, dry run, moves, log/undo, conflict tests | Upcoming |
| Club ledger | Five planned parts: records, SQLite, balance, discrepancies, reporting | Upcoming |
| Volunteer scheduling | Three parts: availability, assignment rule, HTML report | Enrollment open; three written lessons |
| Food-waste reporting | Three parts: meal data, per-serving measures, HTML report | Enrollment open; three written lessons |
| Equipment inventory | Three parts: records/states, overdue counts, HTML report | Enrollment open; three written lessons |
| Class survey report | Three parts: valid responses, proportions, HTML report | Enrollment open; three written lessons |
| Air-quality diary | Three parts: observations, grouping, contextual report | Enrollment open; three written lessons |

The five available paid-course subtitles now match the actual CSV/standard-library/HTML lessons. Booking interfaces, interactive dashboards, live sensor integrations and general-purpose optimization are described as optional later work rather than current deliverables. No extra videos, instructor feedback promises, certificates, testimonials or results were invented.

## Public versus enrolled content

- These pages explain what a learner will build, why it is useful and which concepts it involves. They contain no full Python implementation, complete practice data, worked answer or private resource link.
- The thinking exercises pose a design question; they do not reproduce the paid step-by-step lessons or their expected outputs.
- The full fifteen available paid lesson bodies retain their existing API enrollment checks. No preview flag, price, enrollment availability or access rule was changed.
- Source-download links in the public course header are now explicitly restricted to the free trial. Future paid downloads should use the existing protected lesson resources.
- The complete book project remains free. The four upcoming projects have substantial public outlines; this update does not claim their private lessons are already delivered.

## Editing

- Public copy: `apps/web/src/content/course-guides.json`, indexed by course slug, then `vi` / `en`.
- Public rendering: `apps/web/src/components/catalog/course-public-guide.tsx`.
- Catalog cards and short summaries: `apps/web/src/content/project-courses.json`.
- Full existing teaching material: `content/project-lessons/`; not imported by the public guide component.
- The public copy ships with the frontend, so it does not need a database seed or a production schema migration. The API continues to own prices, actual lesson lists and access.

## Verification

235 frontend tests passed, including catalog-wide bilingual coverage and rendering checks that the preview component contains no code blocks, solution functions, private learning links or download links. Type checks, lint and the optimized frontend build passed. All twenty language/course pages were verified over HTTP. All nine paid learning routes and the fifteen existing paid lesson bodies rejected anonymous access. Forty browser layout checks covered all ten pages in both languages at 360px and 1280px with no horizontal overflow; outline and FAQ expansion were also checked. There are 38 distinct outline parts and 30 course-specific FAQs, each translated into both languages.

Sample: [expanded course outline](screenshots/course-content-2026-11-01.png).
