# eCRM Investor Deck and LinkedIn Brochure Design

Date: 2026-06-30
Status: Draft for user review

## Context

The repo already contains generated sales collateral under `docs/sales-materials`, including a multi-page pitch deck, a two-page brochure, a user guide, a builder script, and runtime screenshots. The current request is to refresh that collateral into two tighter assets based on the latest product state:

- A 6-page investor pitch deck suitable for a conference presentation.
- A 2-page brochure suitable for LinkedIn promotion and lightweight outbound sharing.

The materials need to reflect the real eCRM product as it exists in this checkout. They should use the current positioning around an end-to-end sales and operations workflow, reuse existing generator patterns where practical, avoid calling the product a CRM in outward-facing category language, and avoid invented traction, revenue, customer-count, or fundraising claims that are not supported by the local repo.

## Goals

- Produce one investor-facing deck with exactly 6 slides.
- Produce one LinkedIn-friendly brochure with exactly 2 pages.
- Keep both assets source-backed from the current local product, screenshots, docs, and schema.
- Present eCRM as a broader SalesOS or sales intelligence platform rather than a CRM or contact database.
- Tighten the narrative so the deck reads like an investor conversation instead of a feature dump.
- Reuse the existing HTML-to-PDF generation flow in `docs/sales-materials/build-materials.mjs`.
- Keep `eCRM` as the repo/product name only where needed, while the outward positioning language shifts to `SalesOS` or `sales intelligence platform`.

## Non-Goals

- No Canva, PowerPoint, or external publishing integration in this slice.
- No new screenshot-capture automation unless the existing local assets are clearly insufficient.
- No fabricated TAM, ARR, user-count, customer-logo, or fundraising figures.
- No rebrand mandate for the product name in code; the shift is in category and positioning language, not repository or app renaming.
- No user-guide rewrite unless required for generator stability.

## Chosen Direction

The approved direction is an investor-oriented operating-platform pitch:

- Deck angle: SalesOS for small B2B service teams, with sales intelligence and workflow control as the supporting idea.
- Brochure angle: concise product promotion for LinkedIn and business development.
- Content standard: honest, product-real, conference-ready, with stronger positioning and less module sprawl.

This direction is preferred over a sales-demo-heavy deck because investors need problem framing, market fit, product shape, and why-now positioning before they need detailed module enumeration.

## Asset Structure

### Investor Deck

The deck will be reduced to exactly 6 slides:

1. Title and thesis
   - Present eCRM as a SalesOS or sales intelligence platform, not a CRM.
   - Include a concise promise for small B2B sales and delivery teams.
   - Use a strong headline with one supporting sentence and a grounded visual.

2. Problem
   - Show the operational fragmentation across CRM, proposals, order handoff, delivery tracking, receivables, and follow-up.
   - Frame the pain in workflow terms rather than enterprise-software jargon.

3. Solution
   - Present one lifecycle and one operating workspace.
   - Show the operating flow from demand capture through finance/reporting.
   - Establish the product category and operating model clearly using SalesOS or sales intelligence platform language.

4. Product proof
   - Show the most credible application proof points from the existing product.
   - Prioritize dashboard/reporting visibility, My Day execution, proposal-to-order control, production visibility, and finance awareness.
   - Keep the copy tighter than the current module-heavy deck.

5. Market and why now
   - Position the product as a lighter alternative to disconnected spreadsheets plus heavy CRM tools for SMB or focused service teams.
   - Use narrative positioning only unless the repo contains defensible market metrics.
   - Explicitly avoid fake TAM charts or precise market numbers unless sourced in the repo.

6. Closing and ask
   - End with a conference-ready closing slide.
   - Include product value, what the next build phase enables, and an investor conversation prompt.
   - If investment use-of-funds language is included, it must stay qualitative unless real figures are provided by the user.

### LinkedIn Brochure

The brochure will stay at exactly 2 pages:

1. Front page
   - Strong headline and positioning.
   - One high-quality product screenshot.
   - Three short benefit blocks.
   - Brief call to action suitable for LinkedIn readers and lightweight PDF sharing.

2. Back page
   - Workflow map or lifecycle summary.
   - Focused capabilities list.
   - Good-fit audience blocks.
   - Honest MVP boundaries so the brochure does not oversell unsupported integrations or capabilities.

## Copy Rules

- Use plain business language.
- Prefer "SalesOS", "sales intelligence platform", "operating discipline", "workflow visibility", and "single workspace" over generic CRM marketing language.
- Avoid filler adjectives and exaggerated claims.
- Avoid calling the product a CRM in headlines, subheads, category labels, or concluding statements.
- It is acceptable to mention that the product includes CRM workflow coverage when describing functional scope, but the platform itself should not be categorized as a CRM.
- Avoid saying the product is multi-tenant, mobile-native, AI-first, or deeply integrated with external accounting systems because the repo does not support those claims.
- Avoid numeric traction statements unless they are backed by the local checkout or explicitly supplied by the user.
- Preserve the current reality that proposal documents are external links and that some finance and reporting features are workflow-rich but still MVP-scoped.

## Visual Direction

- Reuse the existing polished sales-materials style as the base so the output remains consistent with the repo.
- Tighten page density for conference readability.
- Keep a professional operating-software tone rather than brochure-like decorative design.
- Use current screenshots that make the product look real and operational.
- Prefer the strongest existing screenshots over adding decorative shapes or generic stock-style visuals.

## Implementation Shape

- Update `docs/sales-materials/build-materials.mjs` so the generated deck contains 6 slides instead of the current longer sequence.
- Update the brochure HTML generator in the same file to match the new LinkedIn-focused structure.
- Replace outward-facing `CRM` framing in deck and brochure copy with broader SalesOS or sales intelligence platform phrasing.
- Regenerate:
  - `docs/sales-materials/ecrm-pitch-deck.html`
  - `docs/sales-materials/ecrm-pitch-deck.pdf`
  - `docs/sales-materials/ecrm-two-page-brochure.html`
  - `docs/sales-materials/ecrm-two-page-brochure.pdf`
- Leave the user guide generation unchanged unless a shared helper refactor is needed.

## Source of Truth

Implementation should derive content from:

- Current product copy and route structure in the local repo.
- Existing screenshots in `docs/sales-materials/assets/screenshots`.
- Existing sales-materials generator patterns.
- Local README and schema-backed feature reality.

If a statement cannot be defended from those sources, it should be softened or removed.

## Error Handling And Risks

- Missing screenshots must not break generation silently; the implementation should fail clearly or continue only with assets that exist.
- Deck length must remain exactly 6 slides after regeneration.
- Brochure length must remain exactly 2 pages after regeneration.
- Copy drift is a higher risk than code complexity here; the implementation should not reuse stale module-copy blocks blindly if they conflict with the new investor narrative.

## Verification

Expected verification:

```powershell
node docs/sales-materials/build-materials.mjs
```

Manual checks after generation:

- Open the generated HTML files and confirm structure and copy.
- Confirm the PDF outputs are regenerated successfully.
- Confirm the deck contains 6 slides.
- Confirm the brochure contains 2 pages.
- Confirm no fabricated traction or market metrics were introduced.

## Acceptance Criteria

- The deck is exactly 6 slides.
- The brochure is exactly 2 pages.
- Both assets are regenerated under `docs/sales-materials`.
- The narrative reflects the approved investor-oriented direction.
- The narrative does not categorize the product as a CRM.
- The content is grounded in the local product rather than invented startup metrics.
- The brochure is suitable for LinkedIn promotion and general PDF sharing.
- Existing unrelated repo work remains untouched.
