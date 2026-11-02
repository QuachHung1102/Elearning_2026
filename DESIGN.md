# CodingBuddy course site — Maker’s Notebook

Status: first local review implementation, 25 October 2026. The user authorized implementation and expressly deferred all uploading and deployment.

## Product and visual intent

A personal course site for students aged 10–15 to learn coding through useful, manageable projects. Course discovery, enrollment, lessons, resources, and progress remain the core product. The homepage introduces the teaching approach and links directly into actual courses; the open practice exercise remains on /workshop.

The user explicitly selected the earlier Maker’s Notebook reference tones. Reuse the exact dark palette from codingbuddy-directions.html: charcoal, cream, coral, lime and slate. Do not substitute blue/white or follow the operating system’s light theme. Personality comes from useful project examples, code-shaped illustrations, the tutor’s voice and deliberate typography. No invented student photography, testimonials, award counts, or completed video series.

The earlier adult-marketplace system is archived in design/redesign/LEGACY-DESIGN.md. Its colors, fonts, composition, and adult positioning are superseded. Functional and security requirements in the technical documents remain applicable.

## Tokens

Source: apps/web/src/app/globals.css. Shared composition: studio.css. Current course-site presentation: course-site.css.

| Role | Value |
| --- | --- |
| Page / charcoal | #242520 |
| Main text / cream | #f3f1e8 |
| Card | #2c2e27 |
| Muted surface | #34362f |
| Supporting text | #b5b9aa |
| Strong supporting text | #c9cbbf |
| Structural border | #4b4e43 |
| Input border | #858978 |
| Primary action / coral | #ff9674 |
| Action foreground | #32231a |
| Secondary project cover / lime | #cadc85 |
| Lime foreground | #303923 |
| Python project cover / slate | #35415b |
| Slate foreground | #e0e8fa |

Coral identifies primary actions, active navigation, focus and brief annotations. Lime and slate distinguish project covers and bounded learning material. The cream top ribbon and cream login button match the reference. Semantic success, warning, destructive and informational surfaces are dark, with readable contrasting text.

## Typography

Be Vietnam Pro is used for navigation, headings, and reading. Weights 400–800 are self-hosted by next/font. IBM Plex Mono is used for actual code and sequence numbers. Both include Vietnamese support.

Public headline: roughly 38–72px by viewport, sentence case, deliberate line breaks matching the reference. Section headings: 25–33px. Long lesson and form text should remain readable; mobile editable inputs are at least 16px. Do not use typography as a decorative label above every block.

## Identity and layout

The wordmark is The CodingBuddy, beside a rotated coral tile with a code symbol. This matches the supplied reference. The teacher monogram is a fallback to a portrait.

Maximum page width: 78rem including responsive gutters. The homepage has a course-first introduction, two featured project courses, a teaching sequence, tutor introduction and purpose. The catalog has search, topic/level/price filters, sorting, real results, and pagination. Cards use two columns on desktop and one on phones, with a colored illustrated cover above each summary. A compact mobile filter button expands the same controls; never duplicate hidden form inputs.

The lesson player, progress controls, authentication and contact form keep their existing behaviors. Paid enrollment now uses the user-requested direct-contact page, described below. Shared tokens bring screens into the same family. Staff tools retain their operational structure.

## Components and states

- Primary actions use coral with dark text. Secondary actions use a clear border or cream surface.
- Use cards for a bounded project, course, form, or note. Ordinary prose and sequences can use whitespace and dividers.
- Practice search combines query and topic. Vietnamese search supports missing diacritics. Empty results explain how to recover.
- A practice note includes a reading and one exercise. It is not a fabricated course completion.
- Course cards hide seeded ratings. The original demo courses are visibly identified as sample content.
- Enrollment checks, prices, archived state, progress, signed downloads, sessions, and CSRF remain owned by the existing API.
- The three new project courses contain nine original written lessons, exercises and four source files. The source manifest is apps/web/src/content/project-courses.json; authored lesson Markdown is in content/project-lessons. Videos remain in preparation.
- New project lessons use the existing preview access rule and open after login. The documented demo learner is seeded with full enrollments to review progress. Non-enrolled readers use the existing untracked preview mode. Free courses lead to reading.
- Paid-course CTAs say “Liên hệ đăng ký học” and open a public direct-contact page at /checkout/[courseSlug]. Show the chosen course, listed fee, owner-provided Zalo contact QR/details, a copyable message and manual access steps. The contact card appears first on phones. No payment session is created. The existing admin enrollment interface grants access after the owner confirms the arrangement.
- Missing contact details use an honest message-icon placeholder. Never display a generated/fake QR or invent a phone number, email or Zalo profile. The config lives in src/content/enrollment-contact.json; future QR images go under public/images.

## Bilingual rules

A non-sensitive codingbuddy-language cookie stores vi/en. Server rendering uses the selected locale. Switching language refreshes server copy without replacing the current route.

Core public pages, authentication forms, practice material, and principal learner controls have English copy. Existing course titles, videos, lesson prose, and legal documents retain their source language and are not silently represented as translated. The legal page explains this in English. Legacy staff interfaces are still primarily Vietnamese.

## Responsive and accessible behavior

At smaller widths navigation becomes a disclosure menu, cards stack, and the catalog’s single filter panel can be expanded. The practice rail stacks above its interface. All essential content and actions remain available.

Use native links and buttons, visible focus, accessible names, proper labels, adequate touch targets, reduced motion, reserved media dimensions, and explicit empty/error states. Avoid scroll hijacking, autoplay decoration, and continuous animation. Native keyboard behavior takes priority over visual novelty.

## Review boundary

This is a local implementation for the user to inspect. No repository push, external upload, payment-provider change, or deployment is part of this phase. User recordings, final curriculum, fees, and verified impact material remain content decisions for the next review.


## Catalog revision — 28 October 2026

The current catalog is one public, free book-sharing trial and nine upcoming paid Python projects. The trial at `/trial/books` has four downloaded recordings, practice notes and source files, available without an account. Paid projects are listed at 100,000₫, 150,000₫ or 200,000₫; each shows its proposed scope and an explicit in-preparation state, with an inquiry rather than immediate enrollment. Old foundation, web and inherited demo courses are removed from the public catalog by archiving; existing account history and progress are preserved. Future paid access remains arranged directly with Nam. The transfer-only archive and setup guide were removed. See `design/redesign/CATALOG-2026-10-28.md` for the active content scope. This revision is pushed to the user-owned repository for review; live deployment remains deferred.


Latest navigation revision: Community and its page/assets were removed. The practice tab (`/workshop`) now shows only the free four-video book-sharing tracker. The three-step strip beneath the homepage hero was removed. Paid project tiers: 100,000₫, 150,000₫, 200,000₫.
