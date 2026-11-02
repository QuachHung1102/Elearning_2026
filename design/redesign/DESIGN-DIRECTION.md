# Design direction — proposal for review

## Working recommendation

A small teaching studio whose visual identity comes from the act of learning and making. Lead with a real project, an understandable lesson, and the tutor's presence. Give a student a specific reason to start.

The current inline concepts explored personality but defaulted to repeated devices: oversized slogan, highlighted phrase, floating code window, small robot, decorative labels, repeated cards, and a broad mission panel. Do not carry this whole arrangement into the next design by inertia.

Changing teal to orange or dark green is insufficient. A substantial redesign changes the information hierarchy, composition, teaching presentation, imagery, typography, and how students move into lessons.

## Three directions to explore with the same content

### A. Working classroom — recommended starting point

The first screen places the current project and a short teaching excerpt at its center. The introduction is brief, and an adjacent lesson outline shows where it leads. The rest of the homepage explains the course, introduces Hải Nam, and shows the purpose behind the teaching.

Personality comes from the actual screen recording, explanation, project details, and thoughtful type. A clear, bright reading surface and one strong functional accent are candidates. Choose the palette after seeing the real material. The lesson interface remains quiet and easy to use.

Best fit: limited assets, a small curriculum, an identifiable tutor, a one-week schedule.

### B. Project fieldbook

Open on an actual project's question, a rough attempt, and its improved result. Use a few short tutor annotations to reveal the thinking. Let each project's media determine its layout; use notes only where there is something useful to explain.

This could connect to Hải Nam's robotics/building interests. Avoid fake handwriting, distressed paper, random tape, and scrapbook decorations. A fieldbook is a way to document decisions, not a texture pack.

Best fit: a working project with real intermediate screenshots and observations.

### C. Community workshop

Open on a teaching scene and a specific story, then connect it to a course or project that students can join. People and work provide the scale and atmosphere.

Best fit: authentic workshop images and concrete stories. The user currently lacks these assets, so this is a later direction, not a reason to generate documentary-looking photos.

## Suggested page structure

Homepage:

```text
Identity                 Learning / About                 VI EN / Account

What this course helps you build
[actual project output or teaching excerpt]   [short introduction]
                                             [clear first lesson action]

What is taught, in its actual sequence
Prerequisites, lesson availability, and expected project outcome

Meet Hải Nam through a short introduction and teaching explanation

Why useful projects matter; a specific, honest account of the mission

Practical questions and contact
```

Course page: meaningful title, project outcome, current availability, prerequisites, clear syllabus, sample lesson, access details. With only a few courses, use direct summaries rather than complex search/filter UI.

Lesson page: readable code, video or text, useful transcript, files, one exercise, current position, and next step. Do not let brand decoration compete with the lesson.

About page: Hải Nam's teaching perspective, why CodingBuddy exists, what is operating now, and what is intended next. Use related résumé experience selectively and accurately.

## Writing direction

Write Vietnamese naturally first and edit English independently for the same meaning. Use specific outcomes and visible actions. Avoid forced wordplay, repeated slogan triplets, vague claims about changing the world, and language suggesting an unlimited catalog.

Possible positioning statement, still a draft:

> CodingBuddy hướng dẫn bạn học lập trình qua những dự án nhỏ có thể giúp ích cho người khác.

> Learn to code through small projects that can help someone.

The homepage needs to explain the actual course more clearly than any slogan. Existing demo titles such as “Học code. Làm điều có ích.” are options, not fixed branding.

## Rules against formulaic output

These are project-specific review criteria, not claims that a particular color, font, or component is inherently bad.

- Do not default to headline-left/code-window-right. Choose composition based on the strongest real material.
- Do not highlight one word in every heading, add uppercase labels above every section, or append arrows to every action.
- Use repeated cards when the content is genuinely comparable, not for every section of a page.
- Do not add stats, quote blocks, partner logos, or a large FAQ because a landing-page template expects them.
- Do not make every section a set of three. Numbering should represent a real sequence.
- Use a character only if it has a role in teaching or feedback and the user likes it. A robot is not required to communicate coding.
- Avoid automatic marquees, typewriter slogans, glowing ornaments, magnetic buttons, and full-screen scroll effects unless there is a specific approved reason.
- Do not replace one default look with another: cream/terracotta, dark/lime, or an austere editorial layout all still need justification.
- Do not invent authenticity. Planned content, example work, and completed work must be distinguishable.
- Do not eliminate ordinary navigation, recognizable buttons, or legible typography merely to be unusual.

## Before approving a direction

1. Produce three compositions using the same genuine content, not three palette swaps.
2. Show each at desktop and phone width, with actual Vietnamese text.
3. Include a homepage and one representative lesson state; a good hero alone does not establish a usable product.
4. Explain why each major choice follows from CodingBuddy's audience and material.
5. Run the name-swap test: if another tutoring company could use it unchanged after replacing the logo, identify what is missing.
6. Run the deletion test: remove elements that repeat a message or provide decoration without adding character or understanding.
7. Check students can identify what is taught, what is ready, who teaches it, and how to start.
8. Have the user approve the composition and a representative screen before implementation begins.

## Final design specification after approval

Record the chosen typefaces and Vietnamese coverage, a small role-based palette, spacing and text scales, page widths, components, interaction states, image treatment, bilingual behavior, responsive decisions, and motion limits in canonical DESIGN.md. Give one role to each visual rule and document exceptions where needed.

The public homepage can be expressive. The course and lesson screens should prioritize comprehension. Account and administrative screens should prioritize reliable task completion. A single brand need not force the same composition onto every surface.
