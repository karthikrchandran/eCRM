# eCRM User Guide Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace stale eCRM sales collateral with one current Markdown/PDF user guide containing fresh screenshots of both Sales and Admin pages.

**Architecture:** The live local Next.js application is the source of truth. Playwright CLI captures role-specific pages into `docs/sales-materials/assets/screenshots/`; `ecrm-user-guide.md` references those images, and Chromium prints the rendered Markdown to `ecrm-user-guide.pdf` without retaining HTML output.

**Tech Stack:** Next.js, Playwright CLI, Markdown, Chromium PDF

---

### Task 1: Capture the current application

**Files:**
- Replace: `docs/sales-materials/assets/screenshots/*.png`

- [x] Start or reuse the local eCRM application at `http://localhost:3000`.
- [x] Sign in as `sales@example.com` and capture the primary Sales pages at a consistent desktop viewport.
- [x] Sign out, sign in as `admin@example.com`, and capture the primary Admin pages at the same viewport.
- [x] Inspect the screenshots for visible page content, correct role chrome, and missing/error states.

### Task 2: Build the current guide

**Files:**
- Create: `docs/sales-materials/ecrm-user-guide.md`
- Replace: `docs/sales-materials/ecrm-user-guide.pdf`

- [x] Write an end-user guide with shared sign-in guidance followed by distinct Sales and Admin sections.
- [x] Reference only screenshots captured during Task 1.
- [x] Render the Markdown to PDF through a temporary browser document.
- [x] Confirm the PDF contains both Sales and Admin headings and screenshots.

### Task 3: Remove obsolete collateral and verify

**Files:**
- Delete: `docs/sales-materials/build-materials.mjs`
- Delete: `docs/sales-materials/ecrm-pitch-deck.html`
- Delete: `docs/sales-materials/ecrm-pitch-deck.pdf`
- Delete: `docs/sales-materials/ecrm-two-page-brochure.html`
- Delete: `docs/sales-materials/ecrm-two-page-brochure.pdf`
- Delete: `docs/sales-materials/ecrm-user-guide.html`
- Delete: `docs/sales-materials/assets/previews/*`

- [x] Remove the explicitly scoped obsolete files and unused screenshots.
- [x] Verify that `docs/sales-materials` contains only the Markdown guide, PDF guide, and referenced screenshots.
- [x] Check every Markdown image path, inspect PDF metadata/page count, and review `git diff --stat` plus `git status --short`.
