# eCRM Sales Workflow Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish the existing eCRM sales workflow so leads, proposals, document links, users, and primary actions feel professional without adding a new sales cockpit or file-storage system.

**Architecture:** Add a small reusable sales UI primitive layer, then apply it to the shell, lead list, proposal form/detail, and proposal document link workflow. Keep server logic in existing proposal/CRM modules and reuse the current `ProposalPdfAttachment` schema by treating `storageKey` as the external document URL for URL-style providers.

**Tech Stack:** Next.js App Router, React 19, Tailwind CSS 4 utility classes, Prisma 6, Zod 4, Vitest, Testing Library, Playwright.

---

## File Structure

- Create `src/components/ui/sales-primitives.tsx`
  - Shared page header, action group, role badge, status badge, metric strip, and empty state components.
- Create `src/components/ui/sales-primitives.test.tsx`
  - Component tests for role badges, status badges, and primary-action contrast class usage.
- Modify `src/app/globals.css`
  - Add missing surface-muted token, stronger focus/hover treatment, and harden `.crm-button-primary` white text.
- Modify `src/components/app-shell.tsx`
  - Use role badge and improved shell identity/nav presentation.
- Modify `src/components/crm/lead-list.tsx`
  - Add professional header, intake actions, summary strip, polished filters, status badges, and empty states.
- Modify `src/components/crm/lead-list.test.tsx`
  - Assert new intake labels, role badge text, empty states, and clearer lead hierarchy.
- Modify `src/components/proposals/proposal-pdf-upload.tsx`
  - Rename UI to proposal document link and replace metadata-heavy labels with document name, URL, optional provider, optional Canva/design URL, and optional checksum fields hidden from the primary flow only if not needed.
- Modify `src/components/proposals/proposal-detail.tsx`
  - Rename PDF metadata section, add open-document links, group proposal context and totals, and use shared badges/empty states.
- Modify `src/components/proposals/proposal-detail.test.tsx`
  - Assert proposal document link behavior and optional Canva link behavior.
- Modify `src/components/proposals/proposal-form.tsx`
  - Polish field grouping and button classes without changing data shape.
- Modify `src/components/proposals/proposal-line-items.tsx`
  - Improve line-item labels, helper text, and control classes.
- Modify `src/server/proposals/validators.ts`
  - Accept URL-style document links in `storageKey`, improve validation messages, and update status-transition copy from PDF metadata to proposal document.
- Modify `src/server/proposals/actions.ts`
  - Map new document-link form fields to the existing metadata input and return user-facing document-link messages.
- Modify `src/server/proposals/actions.test.ts`
  - Test valid external document URL parsing and invalid document URL errors.
- Modify `tests/e2e/products-proposals.spec.ts`
  - Update selectors for refreshed seed names and document-link workflow.
- Modify `prisma/seed.ts`
  - Rename seed users and refresh sample business/document names while preserving seed IDs and login emails.

---

### Task 1: Shared Sales UI Primitives And Global Styling

**Files:**
- Create: `src/components/ui/sales-primitives.tsx`
- Create: `src/components/ui/sales-primitives.test.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Write primitive component tests**

Create `src/components/ui/sales-primitives.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmptyState, PageHeader, RoleBadge, StatusBadge } from "./sales-primitives";

describe("sales UI primitives", () => {
  it("renders admin and sales role badges with distinct labels", () => {
    render(
      <div>
        <RoleBadge role="ADMIN" />
        <RoleBadge role="SALES" />
      </div>
    );

    expect(screen.getByText("Admin")).toBeVisible();
    expect(screen.getByText("Sales")).toBeVisible();
  });

  it("renders a page header with primary actions", () => {
    render(
      <PageHeader
        actions={<a className="crm-button crm-button-primary" href="/leads/new">Add one lead</a>}
        eyebrow="Sales"
        title="Leads"
        description="Manage company-wide lead intake."
      />
    );

    expect(screen.getByText("Sales")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Leads" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Add one lead" })).toHaveClass("crm-button-primary");
  });

  it("renders status badges and empty states", () => {
    render(
      <div>
        <StatusBadge tone="success">Active</StatusBadge>
        <EmptyState title="No matching leads" description="Change filters or add a lead." />
      </div>
    );

    expect(screen.getByText("Active")).toBeVisible();
    expect(screen.getByRole("heading", { name: "No matching leads" })).toBeVisible();
    expect(screen.getByText("Change filters or add a lead.")).toBeVisible();
  });
});
```

- [ ] **Step 2: Run the primitive tests and verify they fail**

Run:

```powershell
npm run test -- src/components/ui/sales-primitives.test.tsx
```

Expected: FAIL because `src/components/ui/sales-primitives.tsx` does not exist.

- [ ] **Step 3: Implement shared primitives**

Create `src/components/ui/sales-primitives.tsx`:

```tsx
import type { UserRole } from "@prisma/client";
import { clsx } from "clsx";

type PageHeaderProps = {
  actions?: React.ReactNode;
  description?: string;
  eyebrow?: string;
  title: string;
};

type StatusTone = "neutral" | "success" | "warning" | "danger" | "info";

const statusToneClasses: Record<StatusTone, string> = {
  danger: "border-red-200 bg-red-50 text-red-700",
  info: "border-sky-200 bg-sky-50 text-sky-700",
  neutral: "border-slate-200 bg-slate-100 text-slate-700",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-amber-200 bg-amber-50 text-amber-800"
};

export function PageHeader({ actions, description, eyebrow, title }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-4 border-b border-[var(--border)] pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? <p className="text-xs font-semibold uppercase tracking-wide text-[var(--accent-strong)]">{eyebrow}</p> : null}
        <h1 className="mt-1 text-2xl font-semibold text-slate-950">{title}</h1>
        {description ? <p className="mt-1 max-w-3xl text-sm text-[var(--muted)]">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}

export function RoleBadge({ role }: { role: UserRole | "ADMIN" | "SALES" }) {
  const label = role === "ADMIN" ? "Admin" : "Sales";
  const classes =
    role === "ADMIN"
      ? "border-indigo-200 bg-indigo-50 text-indigo-700"
      : "border-emerald-200 bg-emerald-50 text-emerald-700";

  return <span className={clsx("inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold", classes)}>{label}</span>;
}

export function StatusBadge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: StatusTone }) {
  return (
    <span className={clsx("inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold", statusToneClasses[tone])}>
      {children}
    </span>
  );
}

export function EmptyState({ actions, description, title }: { actions?: React.ReactNode; description: string; title: string }) {
  return (
    <div className="surface flex min-h-36 flex-col items-start justify-center p-6">
      <h2 className="text-base font-semibold text-slate-950">{title}</h2>
      <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">{description}</p>
      {actions ? <div className="mt-4 flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function MetricStrip({ metrics }: { metrics: Array<{ label: string; value: string; detail?: string }> }) {
  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {metrics.map((metric) => (
        <article className="surface p-4" key={metric.label}>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{metric.label}</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">{metric.value}</p>
          {metric.detail ? <p className="mt-1 text-xs text-[var(--muted)]">{metric.detail}</p> : null}
        </article>
      ))}
    </section>
  );
}
```

- [ ] **Step 4: Harden global styling**

Modify `src/app/globals.css`:

```css
:root {
  --background: #f7f8fa;
  --foreground: #17181c;
  --muted: #667085;
  --border: #d9dee8;
  --panel: #ffffff;
  --surface-muted: #f2f5f8;
  --accent: #126b5f;
  --accent-strong: #0f5149;
}
```

Add or update these blocks in the same file:

```css
.surface {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 1px 2px rgb(15 23 42 / 0.04);
}

.crm-button-primary {
  background: var(--accent);
  color: #ffffff;
}

.crm-button-primary:hover {
  background: var(--accent-strong);
  color: #ffffff;
}

.crm-button-secondary:hover {
  background: var(--surface-muted);
}
```

- [ ] **Step 5: Run primitive tests**

Run:

```powershell
npm run test -- src/components/ui/sales-primitives.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit Task 1**

Run:

```powershell
git add src/components/ui/sales-primitives.tsx src/components/ui/sales-primitives.test.tsx src/app/globals.css
git commit -m "feat: add sales UI primitives"
```

---

### Task 2: Shell Identity And Role Distinction

**Files:**
- Modify: `src/components/app-shell.tsx`
- Test indirectly through Task 1 component tests and final Playwright smoke.

- [ ] **Step 1: Update shell imports**

Modify `src/components/app-shell.tsx` imports:

```tsx
import type { UserRole } from "@prisma/client";
import Link from "next/link";
import { logoutAction } from "@/server/auth/actions";
import { RoleBadge } from "@/components/ui/sales-primitives";
```

- [ ] **Step 2: Replace the header markup**

In `src/components/app-shell.tsx`, keep `baseNavItems` and `navItems`, then replace the returned header/main JSX with:

```tsx
return (
  <div className="min-h-screen">
    <header className="border-b border-[var(--border)] bg-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-start justify-between gap-3 md:block">
          <div className="min-w-0">
            <Link className="text-lg font-semibold text-slate-950" href="/dashboard">
              eCRM
            </Link>
            <p className="text-xs text-[var(--muted)]">Lead-to-cash workspace</p>
          </div>
          <form action={logoutAction} className="shrink-0 md:hidden">
            <button className="crm-button crm-button-secondary text-sm" type="submit">
              Sign out
            </button>
          </form>
        </div>

        <nav className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 text-sm md:mx-0 md:items-center md:overflow-visible md:px-0 md:pb-0">
          {navItems.map((item) => (
            <Link
              className="shrink-0 rounded-md px-3 py-2 font-medium text-slate-700 hover:bg-[var(--surface-muted)] hover:text-slate-950"
              href={item.href}
              key={item.href}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 text-sm md:flex">
          <div className="hidden text-right sm:block">
            <div className="flex items-center justify-end gap-2">
              <p className="font-medium text-slate-950">{user.name}</p>
              <RoleBadge role={user.role} />
            </div>
            <p className="text-xs text-[var(--muted)]">{user.email}</p>
          </div>
          <form action={logoutAction}>
            <button className="crm-button crm-button-secondary text-sm" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
    <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
  </div>
);
```

- [ ] **Step 3: Run typecheck**

Run:

```powershell
npm run typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit Task 2**

Run:

```powershell
git add src/components/app-shell.tsx
git commit -m "feat: clarify shell user identity"
```

---

### Task 3: Lead List Sales Intake Polish

**Files:**
- Modify: `src/components/crm/lead-list.tsx`
- Modify: `src/components/crm/lead-list.test.tsx`

- [ ] **Step 1: Extend the lead list test for intake and badges**

Modify `src/components/crm/lead-list.test.tsx` by adding assertions to the existing test:

```tsx
expect(screen.getByRole("link", { name: "Add one lead" })).toHaveAttribute("href", "/leads/new");
expect(screen.getByRole("link", { name: "Import leads from CSV" })).toHaveAttribute("href", "/leads/import");
expect(screen.getByText("Lead intake")).toBeVisible();
expect(screen.getByText("Sales")).toBeVisible();
expect(screen.getByText("LEAD")).toBeVisible();
```

Add a second test:

```tsx
it("shows a polished empty state when no leads match", () => {
  render(
    <LeadList
      filters={{ q: "missing" }}
      owners={[{ id: "user_sales", name: "Priya Menon", email: "sales@example.com", role: "SALES" }]}
      records={[]}
    />
  );

  expect(screen.getByRole("heading", { name: "No matching leads" })).toBeVisible();
  expect(screen.getByText("Change filters or add a lead to keep sales intake moving.")).toBeVisible();
  expect(screen.getByRole("link", { name: "Add one lead" })).toHaveAttribute("href", "/leads/new");
});
```

- [ ] **Step 2: Run the lead list test and verify it fails**

Run:

```powershell
npm run test -- src/components/crm/lead-list.test.tsx
```

Expected: FAIL because the current labels are `New lead/customer`, `Import CSV`, and no shared role/status badge components are used.

- [ ] **Step 3: Update lead list imports**

Modify `src/components/crm/lead-list.tsx`:

```tsx
import Link from "next/link";
import { EmptyState, MetricStrip, PageHeader, RoleBadge, StatusBadge } from "@/components/ui/sales-primitives";
```

- [ ] **Step 4: Add lead list helper functions**

Add below `formatDate` in `src/components/crm/lead-list.tsx`:

```tsx
function stateTone(state: "LEAD" | "CUSTOMER" | "DORMANT") {
  if (state === "CUSTOMER") {
    return "success" as const;
  }

  if (state === "DORMANT") {
    return "warning" as const;
  }

  return "info" as const;
}

function getLeadMetrics(records: LeadListProps["records"]) {
  const customers = records.filter((record) => record.state === "CUSTOMER").length;
  const openFollowUps = records.filter((record) => record.activities.length > 0).length;

  return [
    { label: "Visible records", value: records.length.toString(), detail: "After current filters" },
    { label: "Customers", value: customers.toString(), detail: "Converted accounts" },
    { label: "Follow-ups", value: openFollowUps.toString(), detail: "Next activity scheduled" },
    { label: "Coverage", value: records.reduce((total, record) => total + record._count.contacts, 0).toString(), detail: "Contacts on visible records" }
  ];
}
```

- [ ] **Step 5: Replace lead list header and filter classes**

In `LeadList`, replace the current `<header>` with:

```tsx
<PageHeader
  actions={
    <>
      <Link className="crm-button crm-button-secondary text-sm" href="/leads/import">
        Import leads from CSV
      </Link>
      <Link className="crm-button crm-button-primary text-sm" href="/leads/new">
        Add one lead
      </Link>
    </>
  }
  eyebrow="Lead intake"
  title="Leads and customers"
  description="Create one sales record at a time or import a qualified list from CSV."
/>
```

Add after the header:

```tsx
<MetricStrip metrics={getLeadMetrics(records)} />
```

Update the filter form class to:

```tsx
<form action="/leads" className="surface grid gap-4 p-4 md:grid-cols-5" method="get">
```

Use `crm-control` for all filter `input` and `select` controls, and use this submit button:

```tsx
<button className="crm-button crm-button-secondary text-sm" type="submit">
  Apply filters
</button>
```

- [ ] **Step 6: Replace empty state branch**

Replace the `records.length === 0` branch with:

```tsx
{records.length === 0 ? (
  <EmptyState
    actions={
      <Link className="crm-button crm-button-primary text-sm" href="/leads/new">
        Add one lead
      </Link>
    }
    title="No matching leads"
    description="Change filters or add a lead to keep sales intake moving."
  />
) : (
  // existing table, updated in the next step
)}
```

- [ ] **Step 7: Polish row badges and owner identity**

Inside each lead row, replace the state pill and owner cell with:

```tsx
<div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
  <StatusBadge tone={stateTone(record.state)}>{record.state}</StatusBadge>
  {record.industry ? <span>{record.industry}</span> : null}
  {record.source ? <span>{record.source}</span> : null}
</div>
```

Owner cell:

```tsx
<td className="px-4 py-4 align-top">
  <div className="flex flex-wrap items-center gap-2">
    <p className="font-medium">{record.owner.name}</p>
    <RoleBadge role={record.owner.role} />
  </div>
  <p className="text-xs text-[var(--muted)]">{record.owner.email}</p>
</td>
```

- [ ] **Step 8: Run the lead list test**

Run:

```powershell
npm run test -- src/components/crm/lead-list.test.tsx
```

Expected: PASS.

- [ ] **Step 9: Commit Task 3**

Run:

```powershell
git add src/components/crm/lead-list.tsx src/components/crm/lead-list.test.tsx
git commit -m "feat: polish lead intake list"
```

---

### Task 4: Proposal Document Link Validation And Actions

**Files:**
- Modify: `src/server/proposals/validators.ts`
- Modify: `src/server/proposals/actions.ts`
- Modify: `src/server/proposals/actions.test.ts`

- [ ] **Step 1: Add action tests for document links**

Modify `src/server/proposals/actions.test.ts` by replacing the "parses PDF metadata forms" test with:

```ts
it("parses proposal document link forms", () => {
  const formData = new FormData();
  formData.set("originalFileName", " Acme proposal ");
  formData.set("documentUrl", "https://example.com/proposals/acme.pdf");
  formData.set("storageProvider", "sharepoint");
  formData.set("canvaDesignUrl", "https://www.canva.com/design/abc");

  expect(parseProposalPdfMetadataFormForTest(formData)).toEqual({
    ok: true,
    data: {
      originalFileName: "Acme proposal",
      storedFileName: "Acme proposal",
      storageProvider: "sharepoint",
      storageKey: "https://example.com/proposals/acme.pdf",
      mimeType: "application/pdf",
      fileSizeBytes: 1,
      canvaDesignUrl: "https://www.canva.com/design/abc"
    }
  });
});

it("rejects invalid proposal document URLs", () => {
  const formData = new FormData();
  formData.set("originalFileName", "Acme proposal");
  formData.set("documentUrl", "not-a-url");

  expect(parseProposalPdfMetadataFormForTest(formData)).toEqual({
    ok: false,
    fieldErrors: {
      documentUrl: ["Enter a valid proposal document URL."]
    }
  });
});
```

- [ ] **Step 2: Run proposal action tests and verify they fail**

Run:

```powershell
npm run test -- src/server/proposals/actions.test.ts
```

Expected: FAIL because `documentUrl` is not parsed yet.

- [ ] **Step 3: Update proposal document schema**

In `src/server/proposals/validators.ts`, replace `proposalPdfMetadataInputSchema` with:

```ts
const proposalDocumentUrl = z.preprocess(emptyToUndefined, z.string().trim().url("Enter a valid proposal document URL."));

export const proposalPdfMetadataInputSchema = z
  .object({
    originalFileName: requiredTrimmedString("Enter the proposal document name."),
    documentUrl: proposalDocumentUrl,
    storedFileName: optionalTrimmedString,
    storageProvider: z.preprocess(emptyToUndefined, z.string().trim().default("external")),
    storageKey: optionalTrimmedString,
    mimeType: z.preprocess(emptyToUndefined, z.literal("application/pdf").default("application/pdf")),
    fileSizeBytes: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).default(1)),
    sha256: optionalTrimmedString,
    canvaDesignUrl: z.preprocess(emptyToUndefined, z.string().trim().url("Enter a valid Canva URL.").optional())
  })
  .transform((value) => ({
    originalFileName: value.originalFileName,
    storedFileName: value.storedFileName ?? value.originalFileName,
    storageProvider: value.storageProvider,
    storageKey: value.storageKey ?? value.documentUrl,
    mimeType: value.mimeType,
    fileSizeBytes: value.fileSizeBytes,
    sha256: value.sha256,
    canvaDesignUrl: value.canvaDesignUrl
  }));
```

Update the status transition error in the same file:

```ts
throw new Error("Add a proposal document link before sending.");
```

- [ ] **Step 4: Update action parser input names**

In `src/server/proposals/actions.ts`, replace the `proposalPdfMetadataInputSchema.safeParse` object with:

```ts
const result = proposalPdfMetadataInputSchema.safeParse({
  originalFileName: formData.get("originalFileName"),
  documentUrl: formData.get("documentUrl"),
  storedFileName: formData.get("storedFileName"),
  storageProvider: formData.get("storageProvider"),
  storageKey: formData.get("storageKey"),
  mimeType: formData.get("mimeType"),
  fileSizeBytes: formData.get("fileSizeBytes"),
  sha256: formData.get("sha256"),
  canvaDesignUrl: formData.get("canvaDesignUrl")
});
```

Update the success message in `addProposalPdfMetadataAction`:

```ts
return { ok: true, message: "Proposal document link saved." };
```

- [ ] **Step 5: Run proposal action tests**

Run:

```powershell
npm run test -- src/server/proposals/actions.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit Task 4**

Run:

```powershell
git add src/server/proposals/validators.ts src/server/proposals/actions.ts src/server/proposals/actions.test.ts
git commit -m "feat: validate proposal document links"
```

---

### Task 5: Proposal Detail Document Link UI

**Files:**
- Modify: `src/components/proposals/proposal-pdf-upload.tsx`
- Modify: `src/components/proposals/proposal-detail.tsx`
- Modify: `src/components/proposals/proposal-detail.test.tsx`

- [ ] **Step 1: Update proposal detail tests**

In `src/components/proposals/proposal-detail.test.tsx`, change the empty-state assertion:

```tsx
expect(screen.getByText("No proposal document linked yet.")).toBeVisible();
```

Add a second test:

```tsx
it("renders external proposal document and optional Canva links", () => {
  render(
    <ProposalDetail
      proposal={{
        ...proposal,
        pdfAttachments: [
          {
            id: "doc_1",
            originalFileName: "Acme proposal final",
            storageProvider: "sharepoint",
            storageKey: "https://example.com/proposals/acme-final.pdf",
            mimeType: "application/pdf",
            fileSizeBytes: 1,
            canvaDesignUrl: "https://www.canva.com/design/acme",
            uploadedAt: new Date("2026-06-16T10:00:00.000Z"),
            uploadedBy: { name: "Kavya Iyer", email: "admin@example.com" }
          }
        ]
      }}
    />
  );

  expect(screen.getByRole("heading", { name: "Proposal documents" })).toBeVisible();
  expect(screen.getByRole("link", { name: "Open document" })).toHaveAttribute("href", "https://example.com/proposals/acme-final.pdf");
  expect(screen.getByRole("link", { name: "Open Canva design" })).toHaveAttribute("href", "https://www.canva.com/design/acme");
});
```

- [ ] **Step 2: Run proposal detail tests and verify they fail**

Run:

```powershell
npm run test -- src/components/proposals/proposal-detail.test.tsx
```

Expected: FAIL because current UI still says `PDF metadata` and does not render `Open document`.

- [ ] **Step 3: Update proposal upload form labels**

In `src/components/proposals/proposal-pdf-upload.tsx`, replace the form body with this user-facing document link flow:

```tsx
<form action={formAction} className="mt-4 grid gap-3 rounded-md border border-[var(--border)] bg-[var(--surface-muted)] p-4">
  <h3 className="font-semibold">Add proposal document link</h3>
  <div className="grid gap-3 md:grid-cols-2">
    <label className="flex flex-col gap-1 text-sm font-medium">
      Document name
      <input className="crm-control" name="originalFileName" placeholder="Final proposal PDF" required type="text" />
    </label>
    <label className="flex flex-col gap-1 text-sm font-medium">
      Document URL
      <input className="crm-control" name="documentUrl" placeholder="https://..." required type="url" />
    </label>
    <label className="flex flex-col gap-1 text-sm font-medium">
      Document source
      <select className="crm-control" defaultValue="external" name="storageProvider">
        <option value="external">External link</option>
        <option value="sharepoint">SharePoint</option>
        <option value="onedrive">OneDrive</option>
        <option value="google_drive">Google Drive</option>
        <option value="local_link">Local/intranet link</option>
      </select>
    </label>
    <label className="flex flex-col gap-1 text-sm font-medium">
      Canva/design URL
      <input className="crm-control" name="canvaDesignUrl" type="url" />
    </label>
  </div>
  <FieldError errors={state.fieldErrors?.originalFileName} />
  <FieldError errors={state.fieldErrors?.documentUrl} />
  <FieldError errors={state.fieldErrors?.canvaDesignUrl} />
  {state.message ? <p className="text-sm text-[var(--muted)]">{state.message}</p> : null}
  <div>
    <button className="crm-button crm-button-primary" disabled={pending} type="submit">
      {pending ? "Saving..." : "Save document link"}
    </button>
  </div>
</form>
```

- [ ] **Step 4: Update proposal detail document section**

In `src/components/proposals/proposal-detail.tsx`, import shared primitives:

```tsx
import { EmptyState, StatusBadge } from "@/components/ui/sales-primitives";
```

Replace the `PDF metadata` section with:

```tsx
<section className="surface p-4">
  <h2 className="text-lg font-semibold">Proposal documents</h2>
  {proposal.pdfAttachments.length === 0 ? (
    <EmptyState title="No proposal document linked yet." description="Add a PDF or document URL so the proposal can be opened from the CRM." />
  ) : null}
  <div className="mt-3 space-y-3">
    {proposal.pdfAttachments.map((attachment) => (
      <article className="rounded-md border border-[var(--border)] p-3" key={attachment.id}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="font-medium">{attachment.originalFileName}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-[var(--muted)]">
              <StatusBadge tone="info">{attachment.storageProvider}</StatusBadge>
              <span>Added by {attachment.uploadedBy.name}</span>
              <span>{formatFileSize(attachment.fileSizeBytes)}</span>
            </div>
            <p className="mt-2 break-all text-xs text-[var(--muted)]">{attachment.storageKey}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a className="crm-button crm-button-primary text-sm" href={attachment.storageKey} rel="noreferrer" target="_blank">
              Open document
            </a>
            {attachment.canvaDesignUrl ? (
              <a className="crm-button crm-button-secondary text-sm" href={attachment.canvaDesignUrl} rel="noreferrer" target="_blank">
                Open Canva design
              </a>
            ) : null}
          </div>
        </div>
      </article>
    ))}
  </div>
  {pdfMetadataAction ? <ProposalPdfUpload action={pdfMetadataAction} /> : null}
</section>
```

- [ ] **Step 5: Run proposal detail tests**

Run:

```powershell
npm run test -- src/components/proposals/proposal-detail.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit Task 5**

Run:

```powershell
git add src/components/proposals/proposal-pdf-upload.tsx src/components/proposals/proposal-detail.tsx src/components/proposals/proposal-detail.test.tsx
git commit -m "feat: show proposal document links"
```

---

### Task 6: Proposal Form Commercial Polish

**Files:**
- Modify: `src/components/proposals/proposal-form.tsx`
- Modify: `src/components/proposals/proposal-line-items.tsx`
- Existing tests: `src/components/proposals/proposal-form.test.tsx`

- [ ] **Step 1: Run existing proposal form test as baseline**

Run:

```powershell
npm run test -- src/components/proposals/proposal-form.test.tsx
```

Expected: PASS before edits.

- [ ] **Step 2: Update proposal form imports**

In `src/components/proposals/proposal-form.tsx`, add:

```tsx
import { PageHeader } from "@/components/ui/sales-primitives";
```

- [ ] **Step 3: Replace proposal form wrapper and controls**

In `ProposalForm`, replace the top of the returned JSX with:

```tsx
<form action={formAction} className="grid max-w-6xl gap-5">
  <input name="opportunityId" type="hidden" value={opportunityId} />
  <PageHeader
    eyebrow="Commercial proposal"
    title="Create proposal"
    description="Capture commercial terms, line items, and delivery assumptions before sending a proposal document link."
  />
  <section className="surface grid gap-4 p-4 sm:p-6">
```

Close that first section after the commercial fields before `<ProposalLineItems products={products} />`.

Use `crm-control` for every input and textarea in `proposal-form.tsx`.

Change the submit button class to:

```tsx
className="crm-button crm-button-primary disabled:opacity-60"
```

- [ ] **Step 4: Update proposal line-item labels and controls**

In `src/components/proposals/proposal-line-items.tsx`, use `crm-control` for all `select` and `input` controls.

Change the section header to:

```tsx
<div>
  <h2 className="text-lg font-semibold">Commercial line items</h2>
  <p className="mt-1 text-sm text-[var(--muted)]">Choose a product/service and price the line in paise for exact GST calculations.</p>
</div>
```

Change the unit price label text to:

```tsx
Unit price (paise)
```

- [ ] **Step 5: Run proposal form tests**

Run:

```powershell
npm run test -- src/components/proposals/proposal-form.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit Task 6**

Run:

```powershell
git add src/components/proposals/proposal-form.tsx src/components/proposals/proposal-line-items.tsx
git commit -m "feat: polish proposal creation flow"
```

---

### Task 7: Seed Data Freshness And E2E Updates

**Files:**
- Modify: `prisma/seed.ts`
- Modify: `tests/e2e/products-proposals.spec.ts`

- [ ] **Step 1: Update E2E selectors for new names and document labels**

In `tests/e2e/products-proposals.spec.ts`, change:

```ts
await selectOptionByText(page.getByLabel("Lead/customer"), /Northstar Learning Pvt Ltd/);
await selectOptionByText(page.getByLabel("Branch"), /Bengaluru Delivery Office/);
await selectOptionByText(page.getByRole("combobox", { exact: true, name: "Owner" }), /Priya Menon/);
```

Replace proposal document workflow selectors:

```ts
const documentName = `proposal-${timestamp}.pdf`;
const documentUrl = `https://example.com/proposals/proposal-${timestamp}.pdf`;
```

Replace PDF metadata form interaction with:

```ts
await page.getByLabel("Document name").fill(documentName);
await page.getByLabel("Document URL").fill(documentUrl);
await page.getByLabel("Document source").selectOption("external");
await page.getByLabel("Canva/design URL").fill("https://www.canva.com/design/e2e");
await page.getByRole("button", { name: "Save document link" }).click();

await expect(page.getByText("Proposal document link saved.")).toBeVisible();
await expect(page.getByText(documentName, { exact: true })).toBeVisible();
await expect(page.getByRole("link", { name: "Open document" })).toHaveAttribute("href", documentUrl);
```

- [ ] **Step 2: Update seed users and sample names**

In `prisma/seed.ts`, keep emails/passwords/IDs stable but update user names:

```ts
await upsertUser({
  name: "Kavya Iyer",
  email: process.env.SEED_ADMIN_EMAIL ?? "admin@example.com",
  password: process.env.SEED_ADMIN_PASSWORD ?? "Admin@12345",
  role: UserRole.ADMIN
});

await upsertUser({
  name: "Priya Menon",
  email: process.env.SEED_SALES_EMAIL ?? "sales@example.com",
  password: process.env.SEED_SALES_PASSWORD ?? "Sales@12345",
  role: UserRole.SALES
});
```

Refresh visible sample business names while preserving IDs:

```ts
name: "Northstar Learning Pvt Ltd",
```

Use this for the branch:

```ts
name: "Bengaluru Delivery Office",
salesContext: "Primary learning operations and enablement team"
```

Use this for the seed contact:

```ts
name: "Anita Rao",
designation: "Head of Learning Operations",
email: "anita.rao@northstar.example",
```

Use this opportunity title and proposal title:

```ts
title: "Northstar LMS modernization",
productInterest: "LMS modernization and onboarding content",
```

```ts
title: "Northstar LMS modernization proposal",
commercialSummary: "Accepted commercial proposal for the Northstar LMS modernization seed order flow.",
```

Update seed proposal document URL fields:

```ts
originalFileName: "northstar-lms-modernization-proposal.pdf",
storageKey: "https://example.com/proposals/northstar-lms-modernization-proposal.pdf",
storageProvider: "external",
storedFileName: "northstar-lms-modernization-proposal.pdf",
```

- [ ] **Step 3: Run focused tests**

Run:

```powershell
npm run test -- src/components/crm/lead-list.test.tsx src/server/proposals/actions.test.ts src/components/proposals/proposal-detail.test.tsx
```

Expected: PASS.

- [ ] **Step 4: Commit Task 7**

Run:

```powershell
git add prisma/seed.ts tests/e2e/products-proposals.spec.ts
git commit -m "test: refresh sales workflow demo data"
```

---

### Task 8: Final Verification

**Files:**
- No source edits unless verification exposes a defect.

- [ ] **Step 1: Run unit and component tests**

Run:

```powershell
npm run test
```

Expected: PASS.

- [ ] **Step 2: Run production gate**

Run:

```powershell
npm run gate
```

Expected: PASS for typecheck, lint, tests, and build.

- [ ] **Step 3: Run focused Playwright proposal flow**

Run:

```powershell
npm run test:e2e -- tests/e2e/products-proposals.spec.ts
```

Expected: PASS. If the local database is not seeded, run `npm run prisma:seed` and retry once.

- [ ] **Step 4: Check formatting whitespace**

Run:

```powershell
git diff --check
```

Expected: no output.

- [ ] **Step 5: Capture final status**

Run:

```powershell
git status --short --branch
git log --oneline -8
```

Expected: branch is `main`; only intentional committed task commits are present; no untracked or unstaged source files remain.

---

## Self-Review Notes

- Spec coverage:
  - Global UI polish: Task 1.
  - Shell and role identity: Task 2.
  - Manual/CSV lead intake and scannable lead list: Task 3.
  - Proposal document links, new-tab opening, optional Canva: Tasks 4 and 5.
  - Proposal commercial polish: Task 6.
  - Demo freshness: Task 7.
  - Verification gates: Task 8.
- No managed storage, PDF upload, embedded viewer, production template builder, or new cockpit is included.
- Existing `ProposalPdfAttachment` is reused, with `storageKey` mapped to the external document URL.
