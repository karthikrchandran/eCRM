# eCRM My Day Sales Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a salesperson `My Day` workspace with daily tasks, completed-task de-emphasis, voice note capture/replay/transcription, draft action suggestions, carry-forward, and end-of-day review.

**Architecture:** Implement this as a new bounded module inside the existing Next.js App Router modular monolith. Keep personal planning tasks separate from CRM `Activity` rows, but link tasks and voice notes to leads, opportunities, proposals, and orders so accepted actions can create CRM activity later without contaminating the customer timeline with private planning items.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Prisma/Postgres, Zod, server actions, route handlers for audio upload/replay, Vitest, Playwright, OpenAI `gpt-4o-transcribe` with `gpt-4o-mini-transcribe` as a configurable lower-cost fallback.

---

## Scope

Build Phase 1 fully and Phase 2 Lite in the same feature area.

Phase 1:

- `/my-day` route in the app shell.
- Daily task list for the signed-in salesperson.
- Manual task creation, complete, reopen, cancel, and reschedule.
- Completed tasks remain visible but visually de-emphasized.
- Voice note upload, original audio replay, transcription status, editable transcript, and draft suggested actions.

Phase 2 Lite:

- End-of-day review.
- Carry-forward unfinished work.
- Suggested tomorrow plan.
- Accounts needing attention.
- Voice note summaries.
- Suggested CRM updates that require explicit user confirmation.

Explicitly defer:

- Manager dashboard.
- Calendar sync.
- Automatic opportunity/proposal/order mutation without confirmation.
- Complex lead scoring.
- Real-time streaming transcription.
- A separate job queue service.

## File Map

- Modify: `prisma/schema.prisma`
  - Add `SalesTask`, `SalesVoiceNote`, `SalesVoiceNoteAction`, `SalesDayReview`, and related enums.
  - Add relation arrays to `User`, `LeadCustomer`, `Opportunity`, `Proposal`, and `Order`.
- Modify: `package.json`
  - Add `openai` dependency.
- Modify: `.env.example`
  - Add `OPENAI_API_KEY`, `SALES_VOICE_TRANSCRIBE_MODEL`, and `SALES_VOICE_STORAGE_DIR`.
- Create: `src/server/sales-day/permissions.ts`
  - Role/ownership checks for personal sales workspace records.
- Create: `src/server/sales-day/validators.ts`
  - Zod schemas for task, voice note, action acceptance, carry-forward, and review forms.
- Create: `src/server/sales-day/types.ts`
  - Shared UI-facing types for task lists, note panels, insights, and review payloads.
- Create: `src/server/sales-day/storage.ts`
  - Audio storage abstraction. Use local filesystem for this implementation; keep the interface ready for Vercel Blob later.
- Create: `src/server/sales-day/transcription.ts`
  - OpenAI transcription and summary/action extraction adapter.
- Create: `src/server/sales-day/queries.ts`
  - `loadMyDay`, `loadMyDayInsights`, and lookup helpers.
- Create: `src/server/sales-day/mutations.ts`
  - Database mutations for task lifecycle, note creation, transcript update, action acceptance, carry-forward, and review.
- Create: `src/server/sales-day/actions.ts`
  - Server actions used by forms and buttons.
- Create: `src/app/(app)/my-day/page.tsx`
  - Server route that loads the signed-in user and renders the workspace.
- Create: `src/app/(app)/my-day/voice-notes/route.ts`
  - `POST` route handler for multipart audio upload.
- Create: `src/app/(app)/my-day/voice-notes/[voiceNoteId]/audio/route.ts`
  - Authenticated audio replay route.
- Create: `src/app/(app)/my-day/voice-notes/[voiceNoteId]/transcribe/route.ts`
  - Authenticated transcription trigger route. This keeps v1 simple without background infrastructure.
- Modify: `src/components/app-shell.tsx`
  - Add `My Day` navigation item for Admin and Sales.
- Create: `src/components/sales-day/my-day-page.tsx`
- Create: `src/components/sales-day/task-composer.tsx`
- Create: `src/components/sales-day/task-list.tsx`
- Create: `src/components/sales-day/task-row.tsx`
- Create: `src/components/sales-day/voice-note-recorder.tsx`
- Create: `src/components/sales-day/voice-note-panel.tsx`
- Create: `src/components/sales-day/suggested-actions-panel.tsx`
- Create: `src/components/sales-day/insights-panel.tsx`
- Create: `src/components/sales-day/end-of-day-review.tsx`
- Create tests:
  - `src/server/sales-day/validators.test.ts`
  - `src/server/sales-day/mutations.test.ts`
  - `src/server/sales-day/queries.test.ts`
  - `src/server/sales-day/transcription.test.ts`
  - `src/components/sales-day/task-list.test.tsx`
  - `src/components/sales-day/voice-note-panel.test.tsx`
  - `tests/e2e/my-day.spec.ts`

## Data Model

Add enums:

```prisma
enum SalesTaskStatus {
  OPEN
  COMPLETED
  CARRIED_FORWARD
  CANCELLED
}

enum SalesTaskPriority {
  LOW
  MEDIUM
  HIGH
  URGENT
}

enum SalesTaskType {
  CALL
  EMAIL
  FOLLOW_UP
  SEND_MATERIAL
  MEETING
  CRM_UPDATE
  CUSTOM
}

enum SalesTaskSource {
  MANUAL
  VOICE_NOTE
  CARRY_FORWARD
  INSIGHT
  CRM
}

enum SalesVoiceNoteStatus {
  UPLOADED
  TRANSCRIBING
  TRANSCRIBED
  FAILED
}

enum SalesSuggestedActionStatus {
  DRAFT
  ACCEPTED
  REJECTED
}

enum SalesDayReviewItemStatus {
  DONE
  MOVE_TO_TOMORROW
  BLOCKED
  WAITING_ON_CUSTOMER
  CANCEL
}
```

Add models:

```prisma
model SalesTask {
  id                String            @id @default(cuid())
  ownerId           String
  leadCustomerId    String?
  opportunityId     String?
  proposalId        String?
  orderId           String?
  title             String
  description       String?
  type              SalesTaskType
  priority          SalesTaskPriority @default(MEDIUM)
  status            SalesTaskStatus   @default(OPEN)
  source            SalesTaskSource   @default(MANUAL)
  dueAt             DateTime?
  completedAt       DateTime?
  cancelledAt       DateTime?
  createdFromNoteId String?
  createdAt         DateTime          @default(now())
  updatedAt         DateTime          @updatedAt

  owner        User         @relation("SalesTaskOwner", fields: [ownerId], references: [id])
  leadCustomer LeadCustomer? @relation(fields: [leadCustomerId], references: [id], onDelete: SetNull)
  opportunity  Opportunity?  @relation(fields: [opportunityId], references: [id], onDelete: SetNull)
  proposal     Proposal?     @relation(fields: [proposalId], references: [id], onDelete: SetNull)
  order        Order?        @relation(fields: [orderId], references: [id], onDelete: SetNull)
  voiceNotes   SalesVoiceNote[]
  suggestedActions SalesVoiceNoteAction[] @relation("CreatedSalesTaskFromAction")
  reviewItems  SalesDayReviewItem[]

  @@index([ownerId, dueAt])
  @@index([ownerId, status])
  @@index([leadCustomerId])
  @@index([opportunityId])
  @@index([proposalId])
  @@index([orderId])
}

model SalesVoiceNote {
  id                 String               @id @default(cuid())
  ownerId            String
  taskId             String?
  leadCustomerId     String?
  opportunityId      String?
  proposalId         String?
  orderId            String?
  audioStorageKey    String
  originalFileName   String
  mimeType           String
  fileSizeBytes      Int
  durationSeconds    Int?
  status             SalesVoiceNoteStatus @default(UPLOADED)
  transcript         String?
  summary            String?
  customerAsk        String?
  nextStep           String?
  processingError    String?
  retainedUntil      DateTime?
  createdAt          DateTime             @default(now())
  updatedAt          DateTime             @updatedAt

  owner        User          @relation("SalesVoiceNoteOwner", fields: [ownerId], references: [id])
  task         SalesTask?    @relation(fields: [taskId], references: [id], onDelete: SetNull)
  leadCustomer LeadCustomer? @relation(fields: [leadCustomerId], references: [id], onDelete: SetNull)
  opportunity  Opportunity?  @relation(fields: [opportunityId], references: [id], onDelete: SetNull)
  proposal     Proposal?     @relation(fields: [proposalId], references: [id], onDelete: SetNull)
  order        Order?        @relation(fields: [orderId], references: [id], onDelete: SetNull)
  actions      SalesVoiceNoteAction[]

  @@index([ownerId, createdAt])
  @@index([taskId])
  @@index([leadCustomerId])
  @@index([status])
}

model SalesVoiceNoteAction {
  id              String                    @id @default(cuid())
  voiceNoteId     String
  createdTaskId   String?
  title           String
  description     String?
  type            SalesTaskType
  suggestedDueAt  DateTime?
  status          SalesSuggestedActionStatus @default(DRAFT)
  confidenceLabel String?
  createdAt       DateTime                  @default(now())
  acceptedAt      DateTime?
  rejectedAt      DateTime?

  voiceNote   SalesVoiceNote @relation(fields: [voiceNoteId], references: [id], onDelete: Cascade)
  createdTask SalesTask?     @relation("CreatedSalesTaskFromAction", fields: [createdTaskId], references: [id], onDelete: SetNull)

  @@index([voiceNoteId])
  @@index([status])
}

model SalesDayReview {
  id        String   @id @default(cuid())
  ownerId   String
  reviewDate DateTime
  notes     String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  owner User @relation("SalesDayReviewOwner", fields: [ownerId], references: [id])
  items SalesDayReviewItem[]

  @@unique([ownerId, reviewDate])
  @@index([ownerId, reviewDate])
}

model SalesDayReviewItem {
  id        String                   @id @default(cuid())
  reviewId  String
  taskId    String
  status    SalesDayReviewItemStatus
  note      String?
  createdAt DateTime                 @default(now())

  review SalesDayReview @relation(fields: [reviewId], references: [id], onDelete: Cascade)
  task   SalesTask      @relation(fields: [taskId], references: [id], onDelete: Cascade)

  @@unique([reviewId, taskId])
  @@index([taskId])
}
```

Add relation arrays:

```prisma
model User {
  salesTasks        SalesTask[]        @relation("SalesTaskOwner")
  salesVoiceNotes   SalesVoiceNote[]   @relation("SalesVoiceNoteOwner")
  salesDayReviews   SalesDayReview[]   @relation("SalesDayReviewOwner")
}

model LeadCustomer {
  salesTasks      SalesTask[]
  salesVoiceNotes SalesVoiceNote[]
}

model Opportunity {
  salesTasks      SalesTask[]
  salesVoiceNotes SalesVoiceNote[]
}

model Proposal {
  salesTasks      SalesTask[]
  salesVoiceNotes SalesVoiceNote[]
}

model Order {
  salesTasks      SalesTask[]
  salesVoiceNotes SalesVoiceNote[]
}
```

## Implementation Tasks

### Task 1: Schema, Dependency, And Environment Foundation

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `package.json`
- Modify: `.env.example`
- Generated: `package-lock.json`

- [ ] Add the enums, models, and relation arrays listed in the Data Model section.
- [ ] Run:

```powershell
npm install openai
npm run prisma:generate
npm run prisma:migrate -- --name add_my_day_sales_workspace
```

- [ ] Add environment documentation:

```text
OPENAI_API_KEY=
SALES_VOICE_TRANSCRIBE_MODEL=gpt-4o-transcribe
SALES_VOICE_STORAGE_DIR=.local-storage/sales-voice-notes
```

- [ ] Run:

```powershell
npm run typecheck
```

Expected: TypeScript passes after Prisma client generation.

- [ ] Commit:

```powershell
git add prisma/schema.prisma package.json package-lock.json .env.example
git commit -m "feat: add my day sales workspace schema"
```

### Task 2: Validators And Permissions

**Files:**
- Create: `src/server/sales-day/permissions.ts`
- Create: `src/server/sales-day/validators.ts`
- Create: `src/server/sales-day/types.ts`
- Create: `src/server/sales-day/validators.test.ts`

- [ ] Implement `permissions.ts`:
  - `assertCanUseSalesWorkspace(user)` allows `ADMIN` and `SALES`.
  - `assertOwnsSalesTask(user, task)` allows owner or `ADMIN`.
  - `assertOwnsSalesVoiceNote(user, note)` allows owner or `ADMIN`.
  - Write errors as plain `Error` messages that server actions can return.

- [ ] Implement `validators.ts` with Zod schemas:
  - `salesTaskInputSchema`
  - `salesTaskUpdateSchema`
  - `salesVoiceNoteUploadMetadataSchema`
  - `acceptSuggestedActionSchema`
  - `salesDayReviewSchema`
  - Helpers to normalize empty strings to `null`.

- [ ] Implement `types.ts`:
  - `SalesDayActionState`
  - `MyDayTaskRecord`
  - `MyDayVoiceNoteRecord`
  - `MyDaySuggestedActionRecord`
  - `MyDayViewModel`
  - `MyDayInsightsViewModel`

- [ ] Test validator behavior:
  - valid task input parses.
  - empty optional IDs become `null`.
  - title is required.
  - invalid enum values fail.
  - end-of-day review requires one valid status per selected task.

- [ ] Run:

```powershell
npm run test -- src/server/sales-day/validators.test.ts
```

Expected: PASS.

- [ ] Commit:

```powershell
git add src/server/sales-day/permissions.ts src/server/sales-day/validators.ts src/server/sales-day/types.ts src/server/sales-day/validators.test.ts
git commit -m "feat: add my day validation and permissions"
```

### Task 3: Query Layer

**Files:**
- Create: `src/server/sales-day/queries.ts`
- Create: `src/server/sales-day/queries.test.ts`

- [ ] Implement `loadMyDay(user, date)`:
  - require Admin or Sales.
  - load tasks where `ownerId = user.id` and due date falls inside the selected day, plus overdue open tasks.
  - include linked lead customer, opportunity, proposal, order, voice notes, and draft actions.
  - return separate arrays: `openTasks`, `overdueTasks`, `completedTasks`, `cancelledTasks`.
  - sort open tasks by priority, due date, and creation date.

- [ ] Implement `loadMyDayLookups(user)`:
  - active lead/customer options.
  - open opportunity options.
  - sent/accepted proposal options.
  - booked/in-production order options.

- [ ] Implement `loadMyDayInsights(user, date)`:
  - unfinished tasks before next day.
  - open tasks with overdue due dates.
  - voice notes created in the last 7 days with summaries or transcripts.
  - accounts needing attention from overdue tasks, draft suggested actions, and opportunities with `nextFollowUpAt <= today`.
  - suggested tomorrow tasks as draft view models only; do not create rows.

- [ ] Tests:
  - Sales user sees only own tasks.
  - Completed tasks are returned separately.
  - Overdue open tasks appear in overdue section even if due date is before selected day.
  - Insights includes opportunity follow-up reminders.

- [ ] Run:

```powershell
npm run test -- src/server/sales-day/queries.test.ts
```

Expected: PASS.

- [ ] Commit:

```powershell
git add src/server/sales-day/queries.ts src/server/sales-day/queries.test.ts
git commit -m "feat: add my day query layer"
```

### Task 4: Mutation Layer

**Files:**
- Create: `src/server/sales-day/mutations.ts`
- Create: `src/server/sales-day/mutations.test.ts`

- [ ] Implement task lifecycle:
  - `createSalesTask(user, input)`
  - `updateSalesTask(user, taskId, input)`
  - `completeSalesTask(user, taskId)`
  - `reopenSalesTask(user, taskId)`
  - `cancelSalesTask(user, taskId)`
  - `carryForwardSalesTask(user, taskId, nextDueAt)`

- [ ] Implement voice-note persistence:
  - `createSalesVoiceNote(user, input)` stores metadata after audio has been saved.
  - `markVoiceNoteTranscribing(user, voiceNoteId)`
  - `saveVoiceNoteTranscript(user, voiceNoteId, result)`
  - `markVoiceNoteFailed(user, voiceNoteId, message)`

- [ ] Implement suggested action lifecycle:
  - `createSuggestedActionsForVoiceNote(voiceNoteId, actions)`
  - `acceptSuggestedAction(user, actionId)` creates a `SalesTask` with `source = VOICE_NOTE`, updates the action to `ACCEPTED`, and stores `createdTaskId`.
  - `rejectSuggestedAction(user, actionId)` updates the action to `REJECTED`.

- [ ] Implement review lifecycle:
  - `saveEndOfDayReview(user, reviewDate, items, notes)`
  - For `MOVE_TO_TOMORROW`, create or update a carried-forward task due tomorrow.
  - For `DONE`, complete the task.
  - For `BLOCKED` and `WAITING_ON_CUSTOMER`, keep the task open but preserve review status.
  - For `CANCEL`, cancel the task.

- [ ] Tests:
  - Complete sets `COMPLETED` and `completedAt`.
  - Reopen clears `completedAt`.
  - Accepting suggested action creates a task and is idempotent for an already accepted action.
  - End-of-day carry-forward creates tomorrow task without deleting today’s task.
  - User cannot mutate another salesperson’s task.

- [ ] Run:

```powershell
npm run test -- src/server/sales-day/mutations.test.ts
```

Expected: PASS.

- [ ] Commit:

```powershell
git add src/server/sales-day/mutations.ts src/server/sales-day/mutations.test.ts
git commit -m "feat: add my day mutations"
```

### Task 5: Audio Storage And Transcription

**Files:**
- Create: `src/server/sales-day/storage.ts`
- Create: `src/server/sales-day/transcription.ts`
- Create: `src/server/sales-day/transcription.test.ts`

- [ ] Implement local audio storage:
  - Base directory from `SALES_VOICE_STORAGE_DIR`, default `.local-storage/sales-voice-notes`.
  - Save files under `ownerId/yyyy-mm/<voiceNoteId>.<extension>`.
  - Reject unsupported MIME types; allow `audio/webm`, `audio/mp4`, `audio/mpeg`, `audio/wav`, and `audio/x-wav`.
  - Set max file size to 25 MB to match OpenAI upload limits.
  - Expose `saveVoiceNoteAudio`, `readVoiceNoteAudio`, and `contentTypeForAudio`.

- [ ] Implement OpenAI transcription:
  - Use model from `SALES_VOICE_TRANSCRIBE_MODEL`, default `gpt-4o-transcribe`.
  - If `OPENAI_API_KEY` is missing, return a controlled failure: `Transcription provider is not configured.`
  - Use a prompt containing eCRM vocabulary:

```text
Transcribe every spoken word. Do not summarize, omit, or clean up spoken content.
The recording is a sales note for an Indian CRM. Common terms include LMS,
eLearning, VR, AR, proposal, PO, GST, invoice, pricing sheet, demo, storyboard,
voiceover, production, payment follow-up, Acme Learning, and customer follow-up.
```

- [ ] Implement action extraction:
  - Keep this deterministic for first pass.
  - Use transcript text and simple patterns for “send”, “follow up”, “schedule”, “call”, “demo”, “pricing”, and “tomorrow”.
  - Create draft actions only; never mutate CRM records automatically.
  - If no clear action is found, create no actions and still save transcript.

- [ ] Tests:
  - unsupported MIME type is rejected.
  - missing API key is a controlled provider failure.
  - action extraction creates draft tasks for “send pricing tomorrow” and “schedule demo”.
  - action extraction does not create actions from vague text.

- [ ] Run:

```powershell
npm run test -- src/server/sales-day/transcription.test.ts
```

Expected: PASS.

- [ ] Commit:

```powershell
git add src/server/sales-day/storage.ts src/server/sales-day/transcription.ts src/server/sales-day/transcription.test.ts
git commit -m "feat: add voice note storage and transcription"
```

### Task 6: Server Actions And Route Handlers

**Files:**
- Create: `src/server/sales-day/actions.ts`
- Create: `src/app/(app)/my-day/voice-notes/route.ts`
- Create: `src/app/(app)/my-day/voice-notes/[voiceNoteId]/audio/route.ts`
- Create: `src/app/(app)/my-day/voice-notes/[voiceNoteId]/transcribe/route.ts`

- [ ] Implement server actions:
  - `createSalesTaskAction`
  - `updateSalesTaskAction`
  - `completeSalesTaskAction`
  - `reopenSalesTaskAction`
  - `cancelSalesTaskAction`
  - `acceptSuggestedActionAction`
  - `rejectSuggestedActionAction`
  - `saveEndOfDayReviewAction`
  - Each action calls `requireUser()`, returns field-level errors where applicable, and revalidates `/my-day`.

- [ ] Implement audio upload route:
  - `POST /my-day/voice-notes`
  - Use `requireUser()`.
  - Parse multipart form data.
  - Save audio via `saveVoiceNoteAudio`.
  - Create `SalesVoiceNote`.
  - Return JSON `{ voiceNoteId, audioUrl, status }`.

- [ ] Implement replay route:
  - `GET /my-day/voice-notes/[voiceNoteId]/audio`
  - Verify the note exists and user owns it or is Admin.
  - Stream stored audio with correct content type.

- [ ] Implement transcription trigger route:
  - `POST /my-day/voice-notes/[voiceNoteId]/transcribe`
  - Verify ownership.
  - Mark note `TRANSCRIBING`.
  - Read audio.
  - Call transcription adapter.
  - Save transcript, summary fields, and draft actions.
  - On failure, save `FAILED` plus `processingError`.
  - Return latest note state.

- [ ] Commit:

```powershell
git add src/server/sales-day/actions.ts src/app/\(app\)/my-day/voice-notes
git commit -m "feat: add my day server actions and voice note routes"
```

### Task 7: Page And Navigation

**Files:**
- Modify: `src/components/app-shell.tsx`
- Create: `src/app/(app)/my-day/page.tsx`
- Create: `src/components/sales-day/my-day-page.tsx`

- [ ] Add `My Day` to `baseNavItems` between `Dashboard` and `Leads`.
- [ ] Implement `page.tsx`:
  - `requireUser()`.
  - Parse optional `date` search param.
  - Load `loadMyDay`, `loadMyDayInsights`, and `loadMyDayLookups`.
  - Render `MyDayPage`.

- [ ] Implement `MyDayPage`:
  - Tabs: `Today`, `Insights`, `End-of-Day Review`.
  - Top strip: planned count, overdue count, completed count, call count.
  - Use no oversized hero; keep laptop-first dense CRM layout.

- [ ] Commit:

```powershell
git add src/components/app-shell.tsx src/app/\(app\)/my-day/page.tsx src/components/sales-day/my-day-page.tsx
git commit -m "feat: add my day route and navigation"
```

### Task 8: Task UI

**Files:**
- Create: `src/components/sales-day/task-composer.tsx`
- Create: `src/components/sales-day/task-list.tsx`
- Create: `src/components/sales-day/task-row.tsx`
- Create: `src/components/sales-day/task-list.test.tsx`

- [ ] Implement `TaskComposer`:
  - title
  - type
  - priority
  - due date/time
  - linked lead/customer
  - linked opportunity/proposal/order
  - description

- [ ] Implement `TaskList`:
  - sections for overdue, focus list, and completed today.
  - completed tasks remain visible.

- [ ] Implement `TaskRow`:
  - checkbox complete/reopen behavior.
  - linked CRM context.
  - priority badge.
  - due time.
  - completed styling:

```tsx
const completedClassName =
  "opacity-60 saturate-50 [filter:blur(0.2px)]";
```

  - Keep text readable; do not use heavy blur.

- [ ] Tests:
  - completed task renders in completed section.
  - completed task has de-emphasis class.
  - open task has active action controls.

- [ ] Run:

```powershell
npm run test -- src/components/sales-day/task-list.test.tsx
```

Expected: PASS.

- [ ] Commit:

```powershell
git add src/components/sales-day/task-composer.tsx src/components/sales-day/task-list.tsx src/components/sales-day/task-row.tsx src/components/sales-day/task-list.test.tsx
git commit -m "feat: add my day task UI"
```

### Task 9: Voice Note UI

**Files:**
- Create: `src/components/sales-day/voice-note-recorder.tsx`
- Create: `src/components/sales-day/voice-note-panel.tsx`
- Create: `src/components/sales-day/suggested-actions-panel.tsx`
- Create: `src/components/sales-day/voice-note-panel.test.tsx`

- [ ] Implement browser recording with `MediaRecorder`.
  - Start.
  - Stop.
  - Upload.
  - Show upload progress state.
  - Use `audio/webm` when supported.

- [ ] After upload:
  - show `Replay recording` audio control.
  - call transcription trigger route.
  - poll or update state after route returns.

- [ ] Implement note panel states:
  - `UPLOADED`: audio replay available, transcript pending.
  - `TRANSCRIBING`: show processing state.
  - `TRANSCRIBED`: show editable transcript, summary, customer ask, next step.
  - `FAILED`: show replay and error; do not hide audio.

- [ ] Implement suggested action panel:
  - Draft action rows.
  - `Create task`.
  - `Reject`.
  - clear copy: `Actions are drafts until accepted.`

- [ ] Tests:
  - replay control remains visible when transcription fails.
  - draft action requires user click before task creation.
  - transcript text renders when available.

- [ ] Run:

```powershell
npm run test -- src/components/sales-day/voice-note-panel.test.tsx
```

Expected: PASS.

- [ ] Commit:

```powershell
git add src/components/sales-day/voice-note-recorder.tsx src/components/sales-day/voice-note-panel.tsx src/components/sales-day/suggested-actions-panel.tsx src/components/sales-day/voice-note-panel.test.tsx
git commit -m "feat: add my day voice note UI"
```

### Task 10: Phase 2 Lite UI

**Files:**
- Create: `src/components/sales-day/insights-panel.tsx`
- Create: `src/components/sales-day/end-of-day-review.tsx`
- Modify: `src/components/sales-day/my-day-page.tsx`

- [ ] Implement `InsightsPanel`:
  - Suggested tomorrow plan.
  - Carry-forward unfinished.
  - Voice note summaries.
  - Accounts needing attention.
  - Suggested CRM updates as informational/draft only.

- [ ] Implement `EndOfDayReview`:
  - List today’s open and completed tasks.
  - Per-task choice: Done, Move to tomorrow, Blocked, Waiting on customer, Cancel.
  - Notes field.
  - Save button.

- [ ] Keep Phase 2 Lite honest:
  - No manager dashboard copy.
  - No automatic CRM mutation copy.
  - No fake AI scoring.

- [ ] Commit:

```powershell
git add src/components/sales-day/insights-panel.tsx src/components/sales-day/end-of-day-review.tsx src/components/sales-day/my-day-page.tsx
git commit -m "feat: add my day insights and end of day review"
```

### Task 11: End-to-End Coverage

**Files:**
- Create: `tests/e2e/my-day.spec.ts`

- [ ] Add Playwright coverage:
  - Login as Sales.
  - Open `/my-day`.
  - Create a task.
  - Complete it.
  - Confirm task remains visible and de-emphasized.
  - Reopen it.
  - Open Insights and confirm suggested sections render.
  - Open End-of-Day Review and move a task to tomorrow.

- [ ] For voice note E2E:
  - Mock route responses if browser audio recording is unstable in CI.
  - Verify uploaded note shows replay and transcript status.
  - Do not require a real OpenAI call in E2E.

- [ ] Run:

```powershell
npm run test:e2e -- tests/e2e/my-day.spec.ts
```

Expected: PASS.

- [ ] Commit:

```powershell
git add tests/e2e/my-day.spec.ts
git commit -m "test: cover my day sales workspace"
```

### Task 12: Final Verification And Documentation

**Files:**
- Modify: `README.md` or `docs/superpowers/specs/2026-06-16-ecrm-sales-workflow-polish-design.md` only if needed to mention the new feature path and env vars.

- [ ] Run focused checks:

```powershell
npm run test -- src/server/sales-day/validators.test.ts src/server/sales-day/queries.test.ts src/server/sales-day/mutations.test.ts src/server/sales-day/transcription.test.ts src/components/sales-day/task-list.test.tsx src/components/sales-day/voice-note-panel.test.tsx
npm run test:e2e -- tests/e2e/my-day.spec.ts
npm run gate
git diff --check
git status --short
```

Expected:

- Focused tests pass.
- E2E passes.
- `npm run gate` passes.
- `git diff --check` has no whitespace errors.
- Worktree is clean after final commit or contains only intentional uncommitted docs if the user requested no commit.

- [ ] Commit final docs if changed:

```powershell
git add README.md docs/superpowers/specs/2026-06-16-ecrm-sales-workflow-polish-design.md
git commit -m "docs: document my day sales workspace setup"
```

## Acceptance Criteria

- `My Day` appears in the app shell for Admin and Sales.
- Sales users can create, update, complete, reopen, cancel, and carry forward their own tasks.
- Completed tasks remain visible and visually de-emphasized without becoming unreadable.
- Voice notes can be uploaded and replayed from the app.
- Transcription uses `gpt-4o-transcribe` by default and fails gracefully if no API key is configured.
- Original audio remains available even if transcription fails.
- Transcripts are editable or at least stored visibly for review before actions are accepted.
- Suggested actions are drafts until the salesperson accepts them.
- End-of-day review can move unfinished work into tomorrow.
- Insights show suggested tomorrow plan, accounts needing attention, and voice note summaries without pretending to be a manager dashboard.
- No CRM opportunity, proposal, order, or activity mutation happens automatically from AI output.

## Rollout Notes

- Local development requires `OPENAI_API_KEY` only for live transcription.
- Without `OPENAI_API_KEY`, task planning and audio replay still work.
- `SALES_VOICE_TRANSCRIBE_MODEL=gpt-4o-mini-transcribe` can be used to halve transcription cost if accuracy is acceptable after testing Indian English, Hindi, and Hinglish samples.
- Keep raw audio retention configurable. Default to 30 days in the product copy and implementation constants.
- Do not run full Phase 2 automation until real salespeople have used the Phase 1 workflow for at least a few days.
