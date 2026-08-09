# CommitArc Neutral Landing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the ARA-specific public sign-in landing page with a customer-neutral CommitArc product experience while leaving authentication behavior unchanged.

**Architecture:** `LoginLanding` remains a presentational server component and replaces its remote ARA image with self-contained CSS gradients and decorative elements. `LoginForm` keeps the existing action and error behavior while receiving neutral welcome copy. Component tests pin the brand, copy, form presence, and absence of legacy or sibling-product branding.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS 4 utility classes, Vitest, Testing Library, Playwright CLI

---

### Task 1: Pin the CommitArc landing contract

**Files:**
- Modify: `src/app/(auth)/login/login-landing.test.tsx`
- Modify: `src/app/(auth)/login/login-form.test.tsx`

- [ ] **Step 1: Replace the ARA landing assertion with the CommitArc contract**

Use this test body in `login-landing.test.tsx`:

```tsx
it("presents the neutral CommitArc experience and sign-in form", () => {
  const { container } = render(<LoginLanding />);

  expect(screen.getByText("CommitArc")).toBeVisible();
  expect(
    screen.getByRole("heading", { name: "Turn every customer commitment into coordinated action." })
  ).toBeVisible();
  expect(
    screen.getByText(
      "Bring conversations, commercial decisions, delivery, and collections into one shared operating view."
    )
  ).toBeVisible();
  expect(screen.getByText("Build momentum")).toBeVisible();
  expect(screen.getByText("Deliver with clarity")).toBeVisible();
  expect(screen.getByText("See the whole picture")).toBeVisible();
  expect(screen.getByRole("button", { name: "Sign in" })).toBeVisible();
  expect(container).not.toHaveTextContent(/ARA Global|eCRM|SignalLoop/i);
  expect(container.querySelector("img")).toBeNull();
});
```

- [ ] **Step 2: Pin the neutral form heading and description**

Add this test to `login-form.test.tsx`:

```tsx
it("uses customer-neutral welcome copy", () => {
  render(<LoginForm />);

  expect(screen.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  expect(screen.getByText("Sign in to continue.")).toBeVisible();
  expect(screen.queryByText(/eCRM|ARA Global|SignalLoop/i)).not.toBeInTheDocument();
});
```

- [ ] **Step 3: Run the focused tests and verify RED**

Run:

```powershell
npm test -- "src/app/(auth)/login/login-landing.test.tsx" "src/app/(auth)/login/login-form.test.tsx"
```

Expected: FAIL because the component still renders ARA Global/eCRM copy and the remote ARA image, and the form still says `Sign in` / `Access the eCRM workspace.`

### Task 2: Implement the neutral CommitArc presentation

**Files:**
- Modify: `src/app/(auth)/login/login-landing.tsx`
- Modify: `src/app/(auth)/login/login-form.tsx`

- [ ] **Step 1: Replace `LoginLanding` with the self-contained CommitArc hero**

Use this component structure and copy:

```tsx
import { LoginForm } from "./login-form";

const capabilities = [
  {
    title: "Build momentum",
    description: "Keep opportunities, decisions, and next actions moving."
  },
  {
    title: "Deliver with clarity",
    description: "Coordinate commitments, owners, milestones, and due dates."
  },
  {
    title: "See the whole picture",
    description: "Connect commercial progress, delivery, and cash in one view."
  }
] as const;

export function LoginLanding() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#07111f] text-white">
      <section className="relative isolate grid min-h-screen lg:grid-cols-[minmax(0,1fr)_28rem]">
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-20 bg-[radial-gradient(circle_at_16%_18%,rgb(59_130_246_/_0.3),transparent_34%),radial-gradient(circle_at_72%_82%,rgb(14_165_233_/_0.18),transparent_38%),linear-gradient(135deg,#06111f_0%,#102a43_55%,#0b1d31_100%)]"
        />
        <div
          aria-hidden="true"
          className="absolute -left-40 top-1/2 -z-10 h-[34rem] w-[34rem] -translate-y-1/2 rounded-full border border-white/10"
        />
        <div
          aria-hidden="true"
          className="absolute left-24 top-1/2 -z-10 h-[24rem] w-[24rem] -translate-y-1/2 rounded-full border border-sky-300/15"
        />

        <div className="flex min-h-[34rem] flex-col justify-between px-6 py-8 sm:px-10 lg:px-14">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-200">CommitArc</p>
            <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-tight text-white sm:text-5xl">
              Turn every customer commitment into coordinated action.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-200">
              Bring conversations, commercial decisions, delivery, and collections into one shared operating view.
            </p>
          </div>

          <div className="grid max-w-3xl gap-3 text-sm text-slate-200 sm:grid-cols-3">
            {capabilities.map((capability) => (
              <div className="rounded-xl border border-white/15 bg-white/[0.08] p-4 backdrop-blur-sm" key={capability.title}>
                <p className="font-semibold text-white">{capability.title}</p>
                <p className="mt-1 leading-6">{capability.description}</p>
              </div>
            ))}
          </div>
        </div>

        <aside className="flex items-center justify-center bg-white/[0.96] px-5 py-8 text-[var(--foreground)] shadow-[-16px_0_40px_rgb(2_12_27_/_0.32)] backdrop-blur">
          <LoginForm />
        </aside>
      </section>
    </main>
  );
}
```

- [ ] **Step 2: Replace only the form heading and description**

In `login-form.tsx`, preserve the form action, fields, error alert, pending behavior, and button. Change the heading block to:

```tsx
<div>
  <h1 className="text-2xl font-semibold">Welcome back</h1>
  <p className="mt-1 text-sm text-[var(--muted)]">Sign in to continue.</p>
</div>
```

- [ ] **Step 3: Run the focused tests and verify GREEN**

Run:

```powershell
npm test -- "src/app/(auth)/login/login-landing.test.tsx" "src/app/(auth)/login/login-form.test.tsx"
```

Expected: both test files pass.

- [ ] **Step 4: Run static gates**

Run:

```powershell
npm run typecheck
npx eslint "src/app/(auth)/login/login-landing.tsx" "src/app/(auth)/login/login-landing.test.tsx" "src/app/(auth)/login/login-form.tsx" "src/app/(auth)/login/login-form.test.tsx" --max-warnings=0
npm run build
```

Expected: typecheck, focused ESLint, and production build pass. The approved date-sensitive reports test is outside this focused slice.

- [ ] **Step 5: Commit the landing implementation only**

Stage only the four landing files; do not stage `.tmp-pg-quality/` or the paused organization-isolation work:

```powershell
git add -- "src/app/(auth)/login/login-landing.tsx" "src/app/(auth)/login/login-landing.test.tsx" "src/app/(auth)/login/login-form.tsx" "src/app/(auth)/login/login-form.test.tsx"
git diff --cached --check
git commit -m "feat: introduce CommitArc landing experience"
```

### Task 3: Restart and visually verify the isolated application

**Files:**
- Verify: `src/app/(auth)/login/login-landing.tsx`
- Verify: `src/app/(auth)/login/login-form.tsx`

- [ ] **Step 1: Restart only the isolated eCRM application process**

Keep the disposable PostgreSQL server on port `55439`. Stop the existing Next.js listener on `3011` only after confirming its command line points to `.worktrees\enterprise-tenancy`, then start `npm run start` from the same worktree with the existing isolated launch environment.

- [ ] **Step 2: Verify the desktop landing page in headed Chrome**

Navigate the existing `ecrm-check` session to `http://127.0.0.1:3011/login`. Confirm CommitArc copy, three capability cards, sign-in form, no customer imagery, and no ARA/eCRM/SignalLoop text. Ignore only the already observed missing `favicon.ico` 404.

- [ ] **Step 3: Verify the narrow layout**

Run:

```powershell
playwright-cli -s=ecrm-check resize 390 844
playwright-cli -s=ecrm-check snapshot
```

Expected: hero and sign-in form remain readable without horizontal overflow; the form follows the hero content in the single-column layout.

- [ ] **Step 4: Verify failed-login behavior is unchanged**

Enter a synthetic invalid email/password, submit, and confirm the generic `Invalid email or password.` alert is visible and associated with the sign-in button. Do not use or log production credentials.

- [ ] **Step 5: Restore desktop size and leave the app open**

Run:

```powershell
playwright-cli -s=ecrm-check resize 1440 900
playwright-cli -s=ecrm-check snapshot
```

Expected: the headed browser remains open on the CommitArc landing page for user inspection.
