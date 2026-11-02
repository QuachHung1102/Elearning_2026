> Superseded catalog: the five-course inventory below records the 27 October version. The active catalog is documented in [CATALOG-2026-10-28.md](CATALOG-2026-10-28.md).

# Content and community review — 27 October 2026

Local-only review. No upload, push or deployment was performed.

## Written courses

| Course | Local URL | Lessons |
|---|---|---|
| Python foundations | http://localhost:5000/courses/python-nen-tang | 6 |
| Web foundations | http://localhost:5000/courses/web-nen-tang | 4 |
| Classroom book exchange | http://localhost:5000/courses/python-tu-sach-lop-minh | 3 |
| Digital-skills guide | http://localhost:5000/courses/web-huong-dan-ky-nang-so | 3 |
| Food-waste data project | http://localhost:5000/courses/python-nhat-ky-lang-phi-thuc-pham | 3 |

All 19 lessons can be completed as written lessons. They include concepts, working examples or explicitly identified additions to earlier code, independent tasks, hints/answers, expected behavior and completion criteria. Timing estimates include practice and are not video durations. Lesson prose is Vietnamese; the interface and course title/subtitle switch between Vietnamese and English.

The previous nine project lesson IDs and their positions are preserved. The guarded local importer updates content in place and adds the two foundation courses; it does not reset existing progress. The local demo learner has access to all five. Original demo video courses have not been presented as completed authored courses or overwritten with unrelated prose.

Source of truth: `content/project-lessons/*.md`. Course ordering and assets: `apps/web/src/content/project-courses.json`. Downloadable examples: `apps/web/public/downloads/projects/`. Twelve Python starter/solution files and a complete web foundation example were added to the existing four project downloads.

Refresh only the isolated review database with `pnpm --filter api exec tsx prisma/seed-project-courses.ts`. It refuses production and non-local targets. Signed resources are attached to the last lesson, with direct example links also included in relevant lesson bodies.

## Community page

Local URL: http://localhost:5000/community

The Community / Cộng đồng link is in guest and signed-in navigation, mobile navigation and footer. Three sample activity reports cover equipment, community classes and continuing resources. Each has an original SVG placeholder illustration and expandable notes. The page uses the approved charcoal, cream, coral, lime and slate palette.

Edit `apps/web/src/content/community-work.json` to replace each story. Replace files under `apps/web/public/images/community/` with approved images and update their paths. The current images are illustrations, not photographs or evidence of events.

`isDraft` keeps a prominent preview notice and sample-image badges. Search indexing is disabled for this draft route, and it is intentionally absent from the sitemap. Keep draft mode until every mock passage and image has been replaced, dates and locations are confirmed, and permissions and supporting records have been reviewed. The record section currently has explicit pending fields rather than fabricated financial or impact totals. Updating that section and adding the final route to the sitemap is part of the later publication review.

## Recording materials

All ten recording scripts are complete in `content/recording-kit/python-path/01..10/RECORDING-SCRIPT.md`. Videos 8–9 include optional split points because the menu and persistence code introduce several concepts. They remain scripts, not completed recordings.

## Review boundaries

- No donations, payment transactions, communications or production database changes.
- No fabricated beneficiaries, event dates, testimonials or donation totals.
- Community content is deliberately mock; teaching content is authored and executable, awaiting Nam's editorial review.
- Recording, captioning, real student pilots and replacing community placeholders remain human content-production work.

## Verification (27 October 2026)

- Frontend: 196 tests across 20 files passed.
- Recording examples: 10 checks passed; project examples: 4 checks passed.
- All 19 lesson sources checked for balanced code fences and resolving local download links; added Python files parse successfully.
- Production compilation and TypeScript checks passed using `pnpm --filter web exec next build --webpack`. The default Turbopack build encountered a local helper-process connection error; the supported Webpack build was used for this preview.
- Browser review covered the bilingual community page, expandable activity notes, mobile navigation, course catalog, six-lesson foundation description and lesson player. Mobile community and lesson views had no horizontal overflow.
- Nothing was uploaded, pushed or deployed.
