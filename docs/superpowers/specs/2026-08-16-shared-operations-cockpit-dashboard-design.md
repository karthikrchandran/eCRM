# Shared Operations Cockpit Dashboard Design

**Status:** Approved direction; implementation not started

## Purpose

Replace the current vertically stacked dashboard with a shared operations cockpit that helps Sales and Admin users understand pipeline, cash, delivery, and follow-up health at a glance. It must present live eCRM data clearly today and grow naturally as more customer history is recorded.

## Audience and scope

The dashboard is for the two existing eCRM roles: `SALES` and `ADMIN`. Both see the same cockpit and the same company-record metrics. Admin retains its existing navigation to team performance and Setup; this proposal does not create a Manager role.

This first slice is a fixed, opinionated company dashboard. It deliberately excludes customer-configured layouts, saved widgets, per-user preferences, chart-builder tooling, and browser-selectable tenant context. Those are future product decisions to make only after a customer asks for them.

## Selected layout

Use the **Operations Cockpit** layout (concept C): a dense but scannable desktop-first grid with a responsive one-column mobile fallback.

1. **Health strip**
   - Pipeline value
   - Booked value
   - Pending receivables
   - Collected payments
   - Delivery risk

   Each card shows the current value, a short period-over-period indicator where history exists, and a small trend graphic. Cards link to the relevant existing detail page.

2. **Commercial and cash row**
   - Pipeline by stage, represented as ordered horizontal value bars.
   - Booked versus collected trend for the most recent six completed/current calendar months.
   - Delivery-risk summary with overdue, blocked, and due-soon work counts.

3. **Operating detail row**
   - Receivables aging buckets.
   - Follow-up health: overdue and upcoming counts, with a short prioritized list.
   - Recent bookings.
   - Recent production work.

The page title retains the current plain-language promise: company-wide sales, billing, collection, production, and follow-up metrics from live CRM records.

## Data model and calculations

The existing `getReportsOverview()` report boundary remains the dashboard's source of truth. The dashboard will consume its current pipeline, collection, finance aging, production, follow-up, order, and target data, then add an explicitly typed cockpit projection for values that require time grouping or risk classification.

### Trend series

The server calculates six month buckets in the active report currency:

- **Booked:** accepted/booked order value grouped by booked date.
- **Collected:** payment amounts grouped by payment date.
- **Pipeline:** open opportunity value grouped by the latest available snapshot/date boundary, with a safe empty state until historical snapshots exist.

The UI never fabricates a trend. When fewer than two meaningful periods exist, it shows the current value and a concise `Not enough history yet` state instead of a percentage change or empty chart.

### Risk classification

Risk is derived at read time; it does not add a new workflow status or alter records.

- **Delivery risk:** production items that are blocked, overdue, or due within the next seven days and not completed or skipped.
- **Follow-up risk:** overdue activity count plus upcoming follow-ups from the current reports projection.
- **Receivables risk:** the existing aging buckets, highlighting the oldest outstanding bucket only when it has a positive value.

Each risk panel links to the current Operations, Finance, My Day, or Reports route. It does not make inline mutations or create new approvals.

## UI implementation boundary

Use the existing eCRM navy, white, cool-gray, and restrained semantic status accents. Implement charts as small accessible SVG components rather than introducing a charting library. Each component needs a text summary, labels, and an empty state so the dashboard remains usable with a screen reader, small data set, or reduced visual complexity.

The existing `src/app/(app)/dashboard/page.tsx` becomes a composition surface. New focused components should own individual charts/panels, and the server reports module should own the typed aggregate calculation. This preserves the current report permissions and avoids direct page-to-database queries.

## Error and empty-state behavior

- Preserve the current protected-route behavior through `requireUser("crm")`.
- A valid user with no orders, payments, opportunities, production work, or activities sees zero-value cards and explanatory empty states, not placeholder data.
- Missing optional history never prevents current-value cards or working detail links from rendering.
- Data is constrained to the deployment's customer-cell runtime; the cockpit does not accept tenant or cell identity from a request or browser setting.

## Validation targets

- Unit tests cover month bucketing, no-history behavior, and every delivery/follow-up/receivables risk threshold.
- Component tests prove Sales and Admin receive the same cockpit content while keeping their existing role-specific navigation.
- Browser coverage proves both personas can view the dashboard, chart summaries are visible, and each drill-through link reaches the existing route.
- Existing report, dashboard, permissions, typecheck, lint, and production-build checks continue to pass.

## Deferred customization

When a real customer asks for variation, treat it as a separately approved product slice. Start by identifying whether the request is a shared customer-cell setting, a role-level default, or a per-user preference. Any later configuration must be persisted, audited, validated server-side, scoped to the customer cell, and come with an explicit fallback dashboard. It is not in scope for this implementation.
