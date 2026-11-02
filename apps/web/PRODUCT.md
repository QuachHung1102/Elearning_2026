# The CodingBuddy

## Users and purpose

Students aged 10–15 learning to use coding and technology for useful projects. Parents may need clear prerequisites, learning format, contact information, and access details.

The product is a polished course site led by Nguyễn Hải Nam. A learner should discover courses, understand what they will build, sign in, open lessons, access resources and continue their progress. Personality supports the course product; it must not replace its core flows.

## Current content

Hải Nam plans to record a project-building video series. Those videos are in preparation. The current implementation includes an open written practice project: a small searchable classroom resource library, with four original short notes, exercises, and bilingual offline source files.

Three authored project courses have also been added for local review: a Python book-sharing tracker, an HTML/CSS digital-skills guide, and a Python CSV food-waste log. Each has three written lessons, exercises, and working source files. All written project lessons are readable after sign-in through existing preview access. Progress requires an enrollment; the local demo learner is seeded with these courses. This review does not add a new backend enrollment or payment flow.

The pre-existing API seed contains demonstration courses, accounts, and lesson material. Those courses are labeled as sample content; seeded ratings are not used as social proof. They are not presented as Hải Nam’s completed video curriculum.

The user’s résumé contains unverified or exaggerated statistics. Do not publish its student, revenue, donation, award, instructor, or partnership counts without confirmation. Describe the education-access mission as an aim until concrete activity and financial commitments are established.

## Core experience

Discover the project and teaching approach; try a written practice; explore available courses; sign in or register; continue lessons; access resources and progress. Instructors and administrators retain the existing authoring and operational flows.

Vietnamese and English interface copy are required. Switching the interface language preserves the route. Videos, authored course content, and legal documents retain their original language unless an actual translation exists.

## Technical contracts

Next.js App Router talks to the NestJS/Prisma API through same-origin /api rewrites. Authentication uses HttpOnly session cookies. Existing authorization, CSRF, course access and progress synchronization remain in force. Legacy payment endpoints and historical order records remain available for existing administration; new enrollment uses the direct-contact flow below.

## Paid enrollment — confirmed 26 October 2026

The user now handles paid-course orders personally. A paid-course CTA opens the public /checkout/[courseSlug] page with the selected course, a Zalo contact QR/contact details, a ready-to-copy message and an explanation of manual access. The page does not create a checkout session, generate a payment QR, poll a payment provider or claim a payment has succeeded. Guests can view contact details without registering first.

The owner supplies the contact QR and contact details later. Until configured in src/content/enrollment-contact.json, the page clearly shows a pending-contact placeholder and no invented links. QR means a Zalo contact QR, not a bank-transfer or payment QR. After arranging enrollment directly and confirming it, the owner grants access using the existing admin enrollment interface. Opening or copying the message does not create an order or unlock a course. Free courses and already-enrolled learners keep their current learning flow.

The new language cookie is a display preference, not authentication. Reading it opts the UI into request-time rendering; public catalog API responses still use their existing data-cache windows.

## Visual system

The active system is the Maker’s Notebook course site in root DESIGN.md, using the user’s exact reference palette. The earlier blue/white implementation and old adult marketplace styling are superseded. Catalog, lesson and account functionality remain intact.

## Local review

The user authorized implementation on 25 October 2026 and explicitly deferred uploading/deployment. Local review uses an isolated database and demo providers. No real credentials, production data, live payments, or external mail delivery are required.

See design/redesign/LOCAL-REVIEW.md for startup and review notes. The prepared product and design briefs record remaining content decisions.


## Catalog revision — 28 October 2026

The current catalog is one public, free book-sharing trial and nine upcoming paid Python projects. The trial at `/trial/books` has four downloaded recordings, practice notes and source files, available without an account. Paid projects are listed at 100,000₫, 150,000₫ or 200,000₫; each shows its proposed scope and an explicit in-preparation state, with an inquiry rather than immediate enrollment. Old foundation, web and inherited demo courses are removed from the public catalog by archiving; existing account history and progress are preserved. Future paid access remains arranged directly with Nam. The transfer-only archive and setup guide were removed. See `design/redesign/CATALOG-2026-10-28.md` for the active content scope. This revision is pushed to the user-owned repository for review; live deployment remains deferred.


Latest navigation revision: Community and its page/assets were removed. The practice tab (`/workshop`) now shows only the free four-video book-sharing tracker. The three-step strip beneath the homepage hero was removed. Paid project tiers: 100,000₫, 150,000₫, 200,000₫.
