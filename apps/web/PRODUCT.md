# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Vietnamese-speaking adults who want to discover, purchase, and complete practical online courses. A single owner teaches and administers the catalog.

## Product Purpose

Sell one-time course access and give learners a clear path from discovery to continued study. Success means the full demo flow works locally before real payment, mail, video, and storage providers are connected.

## Positioning

A focused, single-owner course business with marketplace-grade discovery but no multi-instructor marketplace economics.

## Operating Context

Learners use public catalog pages, account settings, and lesson pages. One administrator manages content and grants access manually until checkout ships. Vietnamese UI and Asia/Ho_Chi_Minh time are mandatory.

## Capabilities and Constraints

- The five-phase scope, sequence, acceptance criteria, API contract, data model, demo seams, and UX behavior are owned by `../../docs/ROADMAP.md`, `../../docs/API_CONTRACT.md`, `../../docs/DATA_MODEL.md`, `../../docs/DEMO_MODE.md`, and `../../docs/UX_PLAN.md`.
- Next.js App Router talks to the NestJS API through same-origin `/api/*` rewrites in the browser and `API_ORIGIN` on the server.
- Session authentication uses HttpOnly cookies and all mutations use double-submit CSRF.
- The product has one owner. Instructor content is static web content, not a database relation.
- Owner identity, portrait, final biography, and legal copy remain open decisions. Do not fabricate them.

## Brand Commitments

The product name is currently `E-learning`. The approved visual system is flat marketplace UI with teal brand color, amber conversion actions, Lexend headings, Inter body text, Lucide icons, a light theme only, and the exact semantic tokens in `../../docs/UX_PLAN.md`.

## Evidence on Hand

The repository contains executable contrast checks, API tests, deterministic demo accounts, and detailed product contracts. It has no approved owner portrait, testimonials, customer logos, or commercial performance claims.

## Product Principles

- Keep one canonical contract for each concern.
- Demo every external integration behind the same seam used in production.
- Protect identity, authorization, and user-owned data at every route boundary.
- Prefer clear task completion over decorative interaction.
- Never present fabricated ratings or claims without an explicit demo label.

## Accessibility & Inclusion

WCAG 2.2 AA is the floor. Keyboard access, visible focus, 44px touch targets, reduced motion, Vietnamese copy, and verified contrast apply from the first component.
