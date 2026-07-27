# Orders and Incentives Visibility Design

**Goal:** Split company-wide finance browsing into role-appropriate surfaces: admin gets separate Orders and Incentives pages with filters, sales gets one combined performance page, and admin setup tools move under a grouped `Setup` section.

**Architecture:** Keep Pipeline unchanged. Reuse existing order and incentive finance data from Prisma and the current finance calculation helpers. Introduce a dedicated orders list page for admin, a dedicated incentives list page for admin, and a combined sales performance page that summarizes a rep's orders and incentives in one place. Update the app shell so admin navigation shows `Setup` as a grouped section and sales navigation points at the combined performance page.

**Tech Stack:** Next.js App Router, React, Prisma, existing finance/reports helpers, Vitest, Playwright.

---

## Route Shape

- Admin:
  - `/orders` shows all orders with filters for owner, status, and time bucket.
  - `/incentives` shows all incentives with filters for owner, status, and time bucket.
  - `Production`, `Products`, `Production config`, and `Settings` appear under `Setup`.
- Sales:
  - `/performance` shows the signed-in rep's orders and incentives together.
  - The page is filterable by `This quarter`, `This year`, and `Custom range`.

## Data Shape

- Orders view needs order number, customer, owner, booked value, status, collected amount, pending receivable, and incentive readiness.
- Incentives view needs incentive status, payable amount, assigned rep, order number, customer, and approval/payout metadata.
- Sales performance view needs a merged list or paired summary cards so the rep can see current bookings and incentive state without jumping between pages.

## Testing

- Update shell tests to reflect grouped admin setup navigation and the new sales nav entry.
- Add route/component tests for the admin orders page, admin incentives page, and sales performance page.
- Verify a sales user can reach finance details without admin-only controls.
- Keep Pipeline tests unchanged unless the nav labels need to move.
