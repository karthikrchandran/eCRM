# eCRM getting started

This tutorial gets a local eCRM demo database to a usable Sales and Admin workflow. eCRM is the lead-to-cash workspace; SignalLoop handles autonomous outreach, inbound ChatHub conversations, and agent scheduling.

## 1. Start locally

From the eCRM repository root:

```powershell
npm install
Copy-Item -LiteralPath .env.example -Destination .env -Force
npx prisma migrate deploy
npm run prisma:seed
npm run dev
```

> `prisma/seed.ts` resets demo data. It is destructive and is not a customer-cell onboarding command. Use the [customer-cell onboarding runbook](operations/customer-cell-onboarding.md) for a dedicated customer installation.

Open `http://localhost:3000`.

This checkout's native local PostgreSQL instance listens on port `54329`; `DATABASE_URL` in `.env` must match it. Docker Compose is optional if you prefer to start the `db` service that way.

## 2. Sign in with a persona

The seed creates two local personas:

| Persona | Local credentials | Primary responsibility |
| --- | --- | --- |
| Admin | `admin@example.com` / `Admin@12345` | Company finance, reports, production configuration, products, incentives, and team performance. |
| Sales | `sales@example.com` / `Sales@12345` | Daily work, leads, contacts, Customer 360, pipeline, proposals, orders, and personal performance. |

Change these values before sharing a deployed environment. They are development seed values only.

eCRM has two current roles: **Sales** and **Admin**. There is no separate Manager role. Give a sales manager the **Admin** role when they need team performance, incentive, finance, configuration, or other company controls; use **Sales** for the commercial workspace without those controls.

Both roles open the shared **Operations Cockpit** on the Dashboard. Start with **Operations health**, then use **Commercial and cash** and **Operating detail** to drill into pipeline, bookings, collections, receivables, delivery risk, and follow-up work.

## 3. Sales workflow

Sales users normally work in this order:

1. **My Day** — review today's follow-ups, priorities, notes, and voice notes.
2. **Leads and Contacts** — create, import, search, and qualify customer records.
3. **Customer 360** — review the account, contacts, timeline, open work, and next action in one place.
4. **Pipeline** — create and progress opportunities through their stages.
5. **Proposals** — generate a margin-aware proposal and publish a version for the customer.
6. **Orders and Production** — book an accepted proposal, track delivery work, and record exceptions.
7. **Finance** — review order-level payment status and the company-level finance view available to the role.
8. **Performance** — review rep-specific results by quarter or year, including targets and incentives.

The sales performance page is rep-specific. Use its sales-person, period, and quarter/year filters instead of relying only on cumulative totals.

## 4. Admin workflow

Admins see the same commercial record plus the operating controls around it:

- **Reports** for company revenue, pipeline, billing, production, and collections.
- **Finance** for company-level revenue, costs, margin, receivables, and payment follow-up.
- **Team performance** for sales-rep targets, bookings, incentive liability, and period filtering.
- **Incentives** for commission and incentive records.
- **Products** and **Production config** for the catalog and fulfillment rules.
- **Settings** for workspace administration.

Use **Finance** for the company's financial position. Use **Team performance** for rep-by-rep results and incentive review.

## 5. Using eCRM with SignalLoop

Keep the applications independently deployed. SignalLoop owns campaign execution, email/voice outreach, ChatHub conversations, autonomous agent activity, and calendar handoffs. eCRM owns sales execution, proposals, orders, production, finance, targets, and incentives.

The shared-record bridge is API-based rather than a direct database write:

- eCRM exposes `/api/shared-records` for shared customer and contact records.
- Protect the endpoint with the same long random `SHARED_DATA_API_TOKEN` configured for the integration.
- Send the token as `Authorization: Bearer <token>`.
- Keep workspace and record identifiers in the integration configuration; do not copy one application's database into the other.

When a SignalLoop agent captures or qualifies a contact, the sales team can inspect the resulting customer context in eCRM. When a sales user creates a proposal, order, or payment follow-up, that remains an eCRM responsibility.

## 6. Customer-cell boundary

Each customer uses a separate eCRM customer-cell database and runtime. The deployment selects the cell through `APP_MODE`, `CELL_ID`, and `CELL_KEY`; users cannot select or switch a customer in the browser. Do not use `npm run prisma:seed` in a customer cell. Follow the [customer-cell onboarding runbook](operations/customer-cell-onboarding.md) and use `npm run prisma:seed:tenant` only after confirming the target cell identity.

## 7. Local quality gates

Before treating a change as ready, run:

```powershell
npm run gate
npm run test:e2e
```

The gate runs type checking, linting, unit tests, and the production build. The browser suite verifies the protected personas and the main sales/admin routes.

## 8. Troubleshooting

- **Database connection errors:** confirm PostgreSQL is listening on `54329` and that `DATABASE_URL` matches `.env`.
- **Missing seeded users:** run `npx prisma migrate deploy` followed by `npm run prisma:seed`.
- **Shared-record requests are unauthorized:** confirm `SHARED_DATA_API_TOKEN` matches on both sides and that the request uses a Bearer token.
- **Voice note files are missing:** local audio is stored under `.local-storage/sales-voice-notes`; configure `BLOB_READ_WRITE_TOKEN` for durable Vercel Blob storage.
