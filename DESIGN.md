---
name: E-learning
description: A clear, focused path through practical Vietnamese learning.
colors:
  background: "#f8fafc"
  foreground: "#0f172a"
  card: "#ffffff"
  card-foreground: "#0f172a"
  muted: "#f1f5f9"
  muted-foreground: "#64748b"
  muted-foreground-strong: "#475569"
  border: "#e2e8f0"
  input: "#64748b"
  overlay: "rgba(15, 23, 42, 0.55)"
  skeleton: "#e2e8f0"
  primary: "#0d9488"
  primary-strong: "#0f766e"
  primary-hover: "#115e59"
  primary-foreground: "#ffffff"
  primary-text: "#0f766e"
  primary-subtle: "#ccfbf1"
  primary-on-subtle: "#0f766e"
  secondary: "#2dd4bf"
  accent: "#d97706"
  accent-hover: "#b45309"
  accent-foreground: "#431407"
  accent-subtle: "#fef3c7"
  on-accent-subtle: "#431407"
  ring: "#0d9488"
  ring-offset: "#f8fafc"
  success: "#15803d"
  success-subtle: "#dcfce7"
  on-success-subtle: "#166534"
  warning: "#b45309"
  warning-subtle: "#fef3c7"
  on-warning-subtle: "#b45309"
  destructive: "#dc2626"
  destructive-hover: "#b91c1c"
  destructive-foreground: "#ffffff"
  destructive-subtle: "#fee2e2"
  on-destructive-subtle: "#991b1b"
  info: "#0369a1"
  info-subtle: "#e0f2fe"
  on-info-subtle: "#075985"
typography:
  display:
    fontFamily: "Lexend, ui-sans-serif, system-ui, sans-serif"
    fontSize: "3rem"
    fontWeight: 700
    lineHeight: 1.125
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Lexend, ui-sans-serif, system-ui, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 700
    lineHeight: 1.222
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Lexend, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.333
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.625
    letterSpacing: "normal"
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.571
    letterSpacing: "normal"
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
  xl: "12px"
  full: "9999px"
spacing:
  unit: "4px"
  control-gap: "8px"
  compact: "12px"
  component: "16px"
  card: "20px"
  cluster: "24px"
  section-mobile: "48px"
  section-desktop: "80px"
components:
  button-primary:
    backgroundColor: "{colors.primary-strong}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.md}"
  button-accent:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-foreground}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "44px"
  button-outline:
    backgroundColor: "{colors.card}"
    textColor: "{colors.card-foreground}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "44px"
  input:
    backgroundColor: "{colors.card}"
    textColor: "{colors.card-foreground}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
    height: "48px"
  panel:
    backgroundColor: "{colors.card}"
    textColor: "{colors.card-foreground}"
    rounded: "{rounded.lg}"
    padding: "16px"
  navigation-item:
    backgroundColor: "{colors.card}"
    textColor: "{colors.card-foreground}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
    height: "44px"
  account-tab-active:
    backgroundColor: "{colors.background}"
    textColor: "{colors.primary-text}"
    padding: "8px 12px"
    height: "44px"
  alert-warning:
    backgroundColor: "{colors.warning-subtle}"
    textColor: "{colors.on-warning-subtle}"
    rounded: "{rounded.lg}"
    padding: "16px"
---

# Design System: E-learning

## Overview

**Creative North Star: "Lộ trình sáng rõ / The Clear Learning Path"**

Every screen should make the learner's next useful step obvious. The visual world is a flat, adult marketplace translated into an Operate-mode product: slate surfaces keep attention on the work, teal establishes trust and orientation, and amber is reserved for commercial conversion. The approved seed is `operate-marketplace-flat-20260904`.

The system feels practical, calm, and exact rather than playful or aspirational. Crisp one-pixel boundaries, compact corners, generous Vietnamese line-height, and a disciplined type hierarchy create clarity without decorative noise. Light and dark themes preserve the same semantic relationships instead of becoming separate identities.

**Key Characteristics:**

- Flat slate surfaces separated by tone and crisp borders.
- Teal identity and navigation signals; amber only for conversion.
- Lexend headings paired with Inter body text, both with Vietnamese support.
- Compact radii, 4px spatial rhythm, and controls no smaller than 44px.
- Purposeful, brief state motion with a complete reduced-motion path.

## Colors

The palette pairs cool slate neutrals with trustworthy teal and a deliberately scarce amber conversion signal. Frontmatter values are the light-theme defaults; the same CSS variables receive these dark-theme overrides: background `#0f172a`, foreground `#f8fafc`, card `#1e293b`, muted `#334155`, muted foreground `#94a3b8`, strong muted foreground `#cbd5e1`, border `rgba(255,255,255,0.08)`, and input `rgba(255,255,255,0.40)`.

### Primary

- **Path Teal:** `primary` marks focus, progress, active tabs, and selected controls that do not carry text.
- **Action Teal:** `primary-strong` is the accessible filled surface for brand actions that carry text; `primary-hover` is its hover state.
- **Reading Teal:** `primary-text` is the brand color for links and icons on page or card surfaces.
- **Trail Teal:** `primary-subtle` with `primary-on-subtle` identifies selected rows and quiet brand badges.
- In dark mode these roles become `#2dd4bf`, `#2dd4bf`, `#5eead4`, `#2dd4bf`, `#134e4a`, and `#5eead4` respectively; on-primary text becomes `#042f2e`.

### Secondary

- **Guide Aqua:** `secondary` is decoration only: illustration strokes, heading rules, and non-semantic chart details. In dark mode it becomes `#14b8a6`.

### Tertiary

- **Decision Amber:** `accent` is the conversion color for purchase and enrollment actions, ratings, and price emphasis. It becomes `#f59e0b` in dark mode; `accent-hover` becomes `#fbbf24`.
- **Status Colors:** success, warning, destructive, and info stay semantic. They always pair with their corresponding subtle surface and `on-*-subtle` text token when used as an alert or badge.

### Neutral

- **Open Slate:** `background` is the page field; `card` is the contained surface.
- **Quiet Slate:** `muted` holds low-priority regions, code blocks, table heads, chips, and empty states.
- **Readable Slate:** `muted-foreground` belongs only on background or card; `muted-foreground-strong` belongs on muted surfaces.
- **Crisp Slate:** `border` is decorative separation. Interactive fields use the stronger `input` boundary.

### Named Rules

**The Two Teals Rule.** Use `primary` for non-text signals and `primary-strong` for filled surfaces that carry text; never place white text on the light-theme `primary` value.

**The Amber Means Decide Rule.** Reserve amber for conversion, rating, and price emphasis; routine navigation and account actions remain teal or neutral.

## Typography

**Display Font:** Lexend (with `ui-sans-serif`, `system-ui`, and `sans-serif` fallbacks)  
**Body Font:** Inter (with `ui-sans-serif`, `system-ui`, and `sans-serif` fallbacks)  
**Label/Mono Font:** Inter for labels; `ui-monospace`, Cascadia Code, Source Code Pro, monospace for identifiers and code

**Character:** Lexend gives destinations and section titles a sturdy, contemporary shape; Inter keeps forms, metadata, and longer Vietnamese text quiet and highly legible. Both ship with Vietnamese glyph support.

### Hierarchy

- **Display** (700, 48px, 54px): desktop hero headlines only; collapse to Headline on narrow screens.
- **Headline** (700, 36px, 44px): mobile hero headlines and primary page titles.
- **Title** (600, 24px, 32px): section and major panel titles.
- **Body** (400, 16px, 26px): default prose and form content, limited to 65ch where reading continuity matters.
- **Label** (600, 14px, 22px): form labels, navigation, button labels, and compact UI. Sentence case only.
- Supporting steps are 12/16, 14/22, 18/30, 20/28, and 30/38; only the documented 400, 500, 600, and 700 weights are loaded.

### Named Rules

**The Vietnamese Breathing Rule.** Keep the documented line-heights and sentence case; never compress stacked Vietnamese diacritics with tight leading or all caps.

## Layout

The page container is fluid up to 1280px with gutters of 16px by default, 24px from 768px, and 32px from 1024px. The base unit is 4px; use only the established 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, and 96px steps. Public-page sections use a 48px vertical rhythm on mobile and 80px from 1024px.

Responsive composition starts as one column at 375px, opens to two columns at 768px, three at 1024px, and up to four within the 1280px container at 1440px. Dense data turns into cards below 768px instead of forcing horizontal scroll. Navigation collapses to a real menu; overlays and drawers retain 44px targets and return focus when closed.

Forms and reading content stay narrow rather than stretching across the viewport: authentication panels top out at 400px, prose at 65ch, and account forms use the available page grid without inflating field width beyond useful reading distance.

## Elevation & Depth

The system is flat by default. Document-flow surfaces use tonal contrast and one-pixel borders, never ambient card shadows. Only truly floating layers receive depth: dropdowns and popovers use the overlay shadow; dialogs and drawers use the modal shadow. In dark mode, floating layers also need a light translucent border because shadow alone is insufficient.

### Shadow Vocabulary

- **Overlay:** `0 8px 24px rgba(15, 23, 42, 0.12)` for dropdowns, tooltips, and popovers.
- **Modal:** `0 16px 48px rgba(15, 23, 42, 0.20)` for dialogs and drawers.

### Named Rules

**The Flat-in-Flow Rule.** If a surface participates in normal document flow, separate it with tone or a one-pixel border, never a shadow.

## Shapes

Corners are compact and functional: 4px for chips and checkboxes, 6px for buttons and fields, 8px for cards and alerts, and 12px only for large overlays or hero containers. Full rounding is reserved for avatars, progress tracks, and genuinely circular icon controls. Cards and fields use crisp one-pixel strokes; decorative borders never substitute for the stronger input boundary required to identify controls.

## Components

Components should feel direct and workmanlike: sturdy targets, short labels, visible boundaries, and color used only for its assigned job.

### Buttons

- **Shape:** compact corners (6px), semibold labels, 44px minimum height; large actions are 48px tall.
- **Primary:** Action Teal with on-primary text; 16px horizontal padding at the default size.
- **Accent:** Decision Amber with dark amber-brown text; use only for purchase or enrollment conversion.
- **Hover / Focus:** shift to the matching hover token over 150ms; the global two-pixel teal focus outline sits two pixels outside the component. Active state moves down by one pixel.
- **Outline / Ghost / Destructive:** outline uses the input-colored border, ghost uses a transparent border and muted hover fill, and destructive is reserved for irreversible or access-removing actions.

### Cards / Containers

- **Corner Style:** compact card corners (8px).
- **Background:** card surface with card foreground text.
- **Shadow Strategy:** none in document flow.
- **Border:** one pixel in the decorative border token.
- **Internal Padding:** 16–20px for ordinary cards; 24px for roomy empty states.

### Inputs / Fields

- **Style:** card background, input-colored one-pixel stroke, 6px radius, 48px minimum height, 8px by 12px padding.
- **Focus:** the global two-pixel ring; hover changes the stroke to teal.
- **Error / Disabled:** error changes the boundary to destructive and adds icon plus text; disabled fields use muted fill and strong muted text.

### Navigation

The 64px sticky site header uses the card surface and a bottom border. Desktop links are 44px-tall sentence-case targets with a muted hover fill. Mobile uses a compact bordered popover. Account navigation is a horizontally scrollable tab row whose active item uses both teal text and a two-pixel bottom indicator.

### Feedback

Alerts combine an 8px container, one-pixel semantic border, subtle semantic surface, icon, explicit title, and readable text. Color never carries the state alone. Empty states use a muted block, 40px Lucide outline icon, and left-aligned action hierarchy.

## Do's and Don'ts

### Do:

- **Do** make the next action visually obvious while keeping routine choices neutral.
- **Do** use teal for identity, focus, progress, and active navigation.
- **Do** reserve amber for conversion, rating, and price emphasis.
- **Do** keep controls at least 44px square and retain the global visible focus treatment.
- **Do** preserve semantic color pairings and test both light and dark themes.
- **Do** use Lucide SVG icons at 1.75 stroke width and accompany state icons with text.

### Don't:

- **Don't** add shadows to in-flow cards, fields, buttons, or page sections.
- **Don't** use amber for routine actions or teal decoration as low-contrast body text.
- **Don't** use white text on light-theme `primary` or `accent`; use the established foreground pairings.
- **Don't** use uppercase UI copy, emoji, playful children's fonts, gradients, or oversized pill-shaped controls.
- **Don't** hard-code spacing, color, or radius values inside components when a system token exists.
- **Don't** introduce motion longer than 300ms or motion that survives the reduced-motion preference.
