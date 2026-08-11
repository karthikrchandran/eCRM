<style>
@page { size: A4; margin: 16mm 14mm 17mm; }
body { color: #172033; font-family: Arial, Helvetica, sans-serif; font-size: 10.5pt; line-height: 1.48; }
h1, h2, h3 { color: #082b63; line-height: 1.2; page-break-after: avoid; }
h1 { border-bottom: 3px solid #1769e0; font-size: 25pt; padding-bottom: 8px; }
h2 { border-bottom: 1px solid #cbd5e1; font-size: 18pt; margin-top: 26px; padding-bottom: 5px; }
h3 { font-size: 13.5pt; margin-top: 20px; }
a { color: #075dcc; }
table { border-collapse: collapse; margin: 12px 0 18px; width: 100%; }
th, td { border: 1px solid #cbd5e1; padding: 7px 8px; text-align: left; vertical-align: top; }
th { background: #eaf2ff; color: #082b63; }
blockquote { background: #f3f7fc; border-left: 4px solid #1769e0; margin: 14px 0; padding: 8px 14px; }
code { background: #eef2f7; border-radius: 3px; padding: 1px 4px; }
img { border: 1px solid #cbd5e1; border-radius: 5px; display: block; height: auto; margin: 10px auto 22px; max-height: 235mm; max-width: 100%; object-fit: contain; page-break-inside: avoid; }
.role-break { break-before: page; page-break-before: always; }
.updated { color: #526173; font-size: 9.5pt; }
</style>

# eCRM User Guide

<p class="updated">Updated July 29, 2026 · Sales workspace and Admin console</p>

eCRM brings customer context, pipeline work, proposals, orders, production, finance, and performance into one operating workspace. This guide explains the pages available to the two current application roles:

- **Sales** users plan and complete customer-facing work.
- **Admin** users supervise company operations, reporting, finance, products, production configuration, and team performance.

The screenshots in this guide were captured from the current local application with seeded demonstration data. Names, amounts, and credentials shown here are not production data.

## 1. Sign in

Open the eCRM URL provided by your administrator. For local development, use `http://localhost:3000/login`.

![eCRM sign-in page](assets/screenshots/login.png)

Enter your email address and password, then select **Sign in**. The application opens the correct workspace for your role.

The local seed provides these development-only users:

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@example.com` | `Admin@12345` |
| Sales | `sales@example.com` | `Sales@12345` |

> These credentials are for local development only. Replace them before sharing or deploying the application.

Use **Sign out** in the page header when you finish.

## 2. Choose the right workspace

| If you need to… | Use |
| --- | --- |
| Plan today’s follow-ups and notes | Sales → **My Day** |
| Find or update a company or contact | Sales → **Leads**, **Contacts**, or **Customer 360** |
| Progress a deal or create a proposal | Sales → **Pipeline** |
| Review your own results | Sales → **Performance** |
| Review company orders, delivery, or receivables | Admin → **Orders**, **Production**, or **Finance** |
| Review targets, incentives, or company reports | Admin → **Team performance**, **Incentives**, or **Reports** |
| Maintain products, delivery stages, or workspace defaults | Admin → **Products**, **Production config**, or **Settings** |

<h1 class="role-break">Sales Workspace</h1>

Sales users see a horizontal navigation bar. Their pages focus on daily work, customer records, pipeline movement, and personal performance.

## 3. Sales dashboard

The **Dashboard** is the quickest company-wide summary. It shows current customer follow-ups, open pipeline, booked orders, collections, receivables, and production work.

![Sales dashboard](assets/screenshots/sales-dashboard.png)

Use the links inside each dashboard section to open the related pipeline or report detail.

## 4. My Day

**My Day** is the sales user’s personal planning workspace.

![Sales My Day page](assets/screenshots/sales-my-day.png)

Use it to:

1. Review open and completed tasks for the selected date.
2. Add a task or text note.
3. Record or upload a voice note.
4. Review suggested actions created from available note context.
5. Close, reopen, move, or cancel work as the day changes.

My Day items are personal to the signed-in user. Creating a note does not silently modify the underlying customer record.

## 5. Leads, contacts, and Customer 360

### Leads

**Leads** holds company-level customer and prospect records.

![Sales leads page](assets/screenshots/sales-leads.png)

From this page you can search and filter records, add one lead, or import a qualified list from CSV. Open a lead to manage branches, contacts, activities, notes, ownership, and follow-up context.

### Contacts

**Contacts** provides a person-focused list across customer records.

![Sales contacts page](assets/screenshots/sales-contacts.png)

Use search and filters to find a contact, then open the record when you need its customer relationship and activity context.

### Customer 360

**Customer 360** combines the customer’s commercial and operating history.

![Sales Customer 360 page](assets/screenshots/sales-customer-360.png)

Use it when preparing for a conversation or handoff. It brings together account details, contacts, notes, activities, pipeline, proposals, orders, production, finance events, and ownership history.

## 6. Pipeline and proposals

**Pipeline** lists sales opportunities and their current stages.

![Sales pipeline page](assets/screenshots/sales-pipeline.png)

To progress a sale:

1. Open **Pipeline** and create or select an opportunity.
2. Confirm the customer, owner, expected value, probability, and next action.
3. Move the opportunity through the configured stages.
4. Create a proposal from the opportunity.
5. Add the commercial summary, terms, delivery assumptions, and product or service line items.
6. Record proposal status changes such as sent, accepted, rejected, expired, or withdrawn.
7. When a proposal is accepted, use its **Book order** action to create the order.

Proposal records preserve the commercial snapshot used at that point in the sale.

## 7. Sales performance

**Performance** shows the signed-in salesperson’s results for a selected period.

![Sales performance page](assets/screenshots/sales-performance.png)

Use the period and quarter/year filters when reviewing targets, bookings, collections, margin contribution, and incentive results. This page is rep-specific; use Admin **Team performance** for comparisons across the team.

## 8. Sales finance and reports

### Finance

The Sales **Finance** view connects booked work to billing, collections, and outstanding amounts available to the role.

![Sales finance page](assets/screenshots/sales-finance.png)

Use it to understand payment status before customer follow-up. Admin users retain the company controls for finance records and approvals.

### Reports

**Reports** provides company-wide sales, customer, order, production, and finance summaries.

![Sales reports page](assets/screenshots/sales-reports.png)

Apply available filters before interpreting totals, especially when comparing a particular owner or period.

<h1 class="role-break">Admin Console</h1>

Admin users see a left navigation panel and a dedicated **Admin Console** header. The primary section contains company operations; the **Setup** section contains configuration pages.

## 9. Admin dashboard

The Admin **Dashboard** uses the same live company records as the Sales dashboard, but the console keeps operating controls and configuration within reach.

![Admin dashboard](assets/screenshots/admin-dashboard.png)

## 10. Customers, pipeline, and orders

### Customer 360

Admins can review company-wide customer context and ownership.

![Admin Customer 360 page](assets/screenshots/admin-customer-360.png)

Use this page for account review, operational handoffs, and investigation across sales, delivery, and finance events.

### Pipeline

Admins can inspect and manage the shared opportunity pipeline.

![Admin pipeline page](assets/screenshots/admin-pipeline.png)

Use owner and stage filters to identify stalled work, concentration, and next-action gaps.

### Orders

**Orders** shows booked commercial records created from accepted proposals.

![Admin orders page](assets/screenshots/admin-orders.png)

Open an order to review its source proposal, customer, branch, owner, line-item snapshots, tax totals, purchase-order metadata, production work, invoices, costs, payments, and incentives.

## 11. Finance, incentives, and team performance

### Finance

Admin **Finance** is the company-level view of revenue, costs, margin, receivables, and payment follow-up.

![Admin finance page](assets/screenshots/admin-finance.png)

Use it for financial status and order-level follow-up. Keep team targets and salesperson comparisons in **Team performance** rather than mixing them with the company finance view.

### Incentives

**Incentives** shows incentive records, status, recipients, and payout readiness.

![Admin incentives page](assets/screenshots/admin-incentives.png)

Review the underlying order and payment state before approving, overriding, rejecting, voiding, or marking an incentive paid.

### Team performance

**Team performance** compares salespeople against targets and period results.

![Admin team performance page](assets/screenshots/admin-team-performance.png)

Choose the period and salesperson filters deliberately. Use the team rollup for comparison, then select an individual rep for detail.

## 12. Admin reports

**Reports** provides the broadest operating summary across sales, finance, production, customers, and products or services.

![Admin reports page](assets/screenshots/admin-reports.png)

Use reports for management review. Use the source page—such as an order, production item, or customer record—when a number needs investigation or correction.

## 13. Production and setup

### Production

**Production** tracks delivery work created from booked orders.

![Admin production page](assets/screenshots/admin-production.png)

Open a work item to manage stages, owners, due dates, notes, completion, exceptions, and skipped reasons.

### Products

**Products** maintains the product and service catalog used by proposals and production mappings.

![Admin products page](assets/screenshots/admin-products.png)

Keep names, descriptions, pricing defaults, tax defaults, and active status current so sales users create consistent proposal line items.

### Production config

**Production config** defines reusable delivery templates and their stages.

![Admin production configuration page](assets/screenshots/admin-production-config.png)

Use it to manage stage order, expected duration, required status, active status, and product or service mappings. Changes affect future operating choices; review them before saving.

### Settings

**Settings** contains workspace-level defaults.

![Admin settings page](assets/screenshots/admin-settings.png)

Only administrators can change these values. Confirm the business impact of currency or other shared defaults before updating them.

## 14. Role and data rules

- eCRM currently supports one company workspace rather than multiple tenants.
- Sales and Admin users work from shared company records.
- Ownership indicates responsibility and supports filtering, targets, and incentives; it is not a private-record boundary between salespeople.
- Admin-only setup pages are not shown in the Sales navigation.
- SignalLoop or other connected applications exchange approved shared records through APIs; they must not write directly to the eCRM database.
- Browser voice transcription depends on browser support. Uploaded audio can be stored even when automatic transcript text is unavailable.

## 15. Troubleshooting

| Problem | What to check |
| --- | --- |
| You return to the sign-in page | Your session may have expired. Sign in again. |
| A page is missing from navigation | Confirm that you are using the correct Sales or Admin account. |
| Expected records are missing | Clear filters and confirm the selected owner, period, stage, or status. |
| A Sales user cannot open setup | Products, production configuration, settings, and team controls require Admin access. |
| Voice recording is unavailable | Confirm microphone permission and browser speech-recognition support. |
| Local login shows a database error | Confirm PostgreSQL is running on the port configured by `DATABASE_URL`, then refresh the page. |

For local setup, database migration, seeding, and integration details, see [`docs/getting-started.md`](../getting-started.md).
