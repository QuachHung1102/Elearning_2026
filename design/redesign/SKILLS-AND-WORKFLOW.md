# Skills, sources, and agent workflow

Reviewed 25 October 2026. Sources below were inspected as research. No third-party skills, hooks, scripts, or executables were installed or run. The official skill catalog was queried using the existing skill-installer helper.

## Recommended small toolkit

### Anthropic frontend-design — design planning reference

[SKILL.md](https://github.com/anthropics/claude-code/blob/main/plugins/frontend-design/skills/frontend-design/SKILL.md)

Useful for choosing a subject-specific composition and reviewing it before building. The current document also recognizes that formerly distinctive palettes and decorative typography can become defaults. Use this as the primary general design reference, subordinate to CodingBuddy's brief. Its provenance does not make the instructions specific to only one model.

### Impeccable — structured review candidate

[Repository and commands](https://github.com/pbakaus/impeccable)

[Current SKILL.md](https://github.com/pbakaus/impeccable/blob/main/.agents/skills/impeccable/SKILL.md)

Its planning, critique, simplification, and responsive/internationalization review workflows are useful candidates. It distinguishes presentation, reading, and operational interfaces. The current package includes a launcher and supporting files; copying a single SKILL.md would not reproduce the full workflow. If chosen later, inspect and install the supported package deliberately. For now, keep its role as a reviewed reference rather than pretending its commands are available.

The existing `apps/web/PRODUCT.md` already carries an Impeccable schema marker. That indicates a document format, not proof that a functioning skill is installed.

### Vercel web-design-guidelines — implementation review

[SKILL.md](https://github.com/vercel-labs/agent-skills/blob/main/skills/web-design-guidelines/SKILL.md)

[Guidelines](https://vercel.com/design/guidelines)

Use later for keyboard behavior, forms, responsiveness, localization, media, and performance review. These provide implementation checks, not CodingBuddy's visual identity. Keep its company-specific copy preferences separate from this project's voice, and retain the existing WCAG 2.2 AA requirement.

### Taste Skill — inspected; not recommended as the governing skill

[Inspected SKILL.md](https://github.com/tasteskill/tasteskill/blob/main/skills/taste-skill/SKILL.md)

It contains useful reminders about dependencies and UI states, but also prescribes strong layout defaults, specific icon libraries, substantial animation, and continuous motion. Some rules conflict with each other or with the simpler teaching experience proposed here. It also suggests believable placeholder data; that is not acceptable evidence for this project. Do not activate it wholesale or combine its mandates with another design system.

## Existing available tools

- The visualization skill supports in-conversation concept exploration and approval. It does not authorize production implementation.
- Computer/browser tools support rendered checks once the next proof exists.
- Image generation can supply clearly illustrative artwork if a chosen design needs it. It must not fabricate teaching photos, students, or project results.
- Figma is available if the user wants a Figma deliverable. It is optional for this workflow and is not a prerequisite to a distinctive result.

## Teaching references, not visual templates

- [micro:bit Make it: code it](https://microbit.org/projects/make-it-code-it/): useful examples of concrete outcomes connected to small coding concepts. Its much larger catalog and filter system should not be copied into CodingBuddy's small offering.
- [Exploratorium Tinkering Studio](https://www.exploratorium.edu/tinkering): a useful reference for explaining learning through making and experimentation. CodingBuddy still needs its own teaching evidence and scale.
- Raspberry Pi Projects was considered, but its page exposed only a JavaScript-required message to the text reader. No visual assessment or detailed recommendation is based on that fetch.

## How the agent should work

### Preparation — current phase

Use the confirmed product facts, inventory real content, examine the incumbent, research references, and record decisions. Do not infer approval from prototype browsing. Drafts may be revised without changing the live app.

### Next design proof — before implementation

Use one representative project and lesson. Compare the Working classroom, Project fieldbook, and, only with appropriate assets, Community workshop directions. Show substantive layout differences, bilingual copy, and a sample lesson. Critique in a distinct pass before presenting the proof. Record retained and rejected decisions so subsequent generations do not revert to the previous template.

### After explicit implementation approval

1. Reconcile PRODUCT.md, DESIGN.md, and visual sections of UX_PLAN.md with the approved brief.
2. Implement one representative course-to-lesson journey with shared components.
3. Verify the rendered result at desktop and phone sizes in both languages. Repair observed issues.
4. Extend the approved system to other public and learner screens. Keep staff workflows stable within the agreed scope.
5. Run the repo's relevant type checks, tests, and build, plus browser checks for the altered interactions. Review available content, captions, downloads, and empty/error states.
6. Present the concrete result and remaining limits for the next deployment decision.

## Reusable task instruction

> Read design/redesign/README.md, PRODUCT-BRIEF.md, and DESIGN-DIRECTION.md. Use confirmed facts and the approved design, if any. Treat the older adult-marketplace documents as incumbent evidence where they conflict with the current brief. Propose or execute only the phase the user has authorized. Before adding a visual device, explain its purpose for this particular content and audience. Never fill gaps with invented courses, proof, or impact. When implementing, preserve the existing functional contracts, check both languages, inspect the rendered page, and record the decisions that keep CodingBuddy distinct.

## Limits

A skill can enforce choices and checks; it cannot guarantee originality or replace an actual lesson, project, or point of view. File names alone do not make instructions automatically active. Until a supported installation or an explicit read occurs, these are documented research references. The user controls the implementation gate.
