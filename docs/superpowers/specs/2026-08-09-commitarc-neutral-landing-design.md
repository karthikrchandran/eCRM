# CommitArc Neutral Landing Page Design

**Status:** Approved for implementation
**Date:** 2026-08-09
**Scope:** Public sign-in landing page only

## Decision

Rename the independently sellable CRM product from the internal name `eCRM` to **CommitArc** on its public sign-in surface. CommitArc represents the arc of a customer commitment from opportunity through delivery and payment. It remains commercially and technically separate from SignalLoop.

The unauthenticated landing page must be customer-neutral. It must not render ARA Global names, copy, imagery, URLs, colors presented as ARA identity, or industry-specific messaging. It must not mention SignalLoop or imply that the products must be purchased together.

## Visual direction

Use a self-contained abstract background built from CSS gradients and restrained geometric accents. Do not depend on a remote customer image. Retain the current two-column desktop structure and responsive single-column behavior so the change does not disrupt the established login interaction.

The visual character should feel like a modern enterprise operating workspace: dark, confident, calm, and readable. CommitArc is the primary wordmark. No customer logo appears in the neutral fallback.

## Content

The hero introduces CommitArc without calling it a CRM:

- Brand: `CommitArc`
- Headline: `Turn every customer commitment into coordinated action.`
- Supporting copy: `Bring conversations, commercial decisions, delivery, and collections into one shared operating view.`
- Capability cards:
  - `Build momentum` - keep opportunities and next actions moving;
  - `Deliver with clarity` - coordinate commitments, owners, and due dates;
  - `See the whole picture` - connect commercial progress, delivery, and cash.

The form remains functionally unchanged and uses neutral language such as `Welcome back` and `Sign in to continue`.

## Component boundaries

- `LoginLanding` owns the neutral CommitArc presentation and layout.
- `LoginForm` continues to own authentication fields, validation, submission, and errors.
- No organization lookup, hostname routing, or tenant-branding data flow is added in this slice.
- Later tenant-branding work may replace the neutral presentation after a tenant can be resolved safely; missing or unresolved branding must continue to render CommitArc, never ARA Global.

## Assets and failure behavior

The page uses no remote hero asset, so network or third-party image failures cannot degrade the primary landing experience. Authentication errors remain generic and continue through the existing form behavior. The page must remain usable with CSS backgrounds unavailable or reduced-motion preferences enabled.

## Testing and acceptance

Automated component tests must prove:

- CommitArc brand and approved neutral copy render;
- the sign-in form remains present;
- no `ARA Global`, `eCRM`, or `SignalLoop` text renders;
- no external ARA image URL or ARA-specific image alternative text remains;
- the landing page has no remote hero-image dependency.

Run the focused landing tests, TypeScript, focused lint, and a production build. Perform a headed browser check at desktop and narrow viewport widths, including a failed-login validation check. Restart the isolated application after the build so the approved page is available for manual inspection.

## Non-goals

- Tenant-specific pre-login branding or hostname resolution;
- a full design-system or authenticated-shell rename;
- changes to authentication, session, authorization, or organization isolation;
- bundling or cross-selling SignalLoop;
- formal trademark clearance. The CommitArc name requires legal and trademark review before commercial launch.
