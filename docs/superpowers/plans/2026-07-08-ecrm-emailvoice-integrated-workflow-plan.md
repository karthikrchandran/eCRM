# eCRM + EmailVoice Integrated Workflow Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the next wave of capability so eCRM and EmailVoice work together as one connected sales operating workflow that matches the original graphic.

**Architecture:** eCRM remains the system of record for lead-to-cash execution (lead/customer/opportunity/proposal/order/production/finance). EmailVoice remains the system of record for outreach, engagement, calls, and scheduling. The missing layer is a shared workflow event contract and timeline so actions from one system create meaningful workflow state in the other.

**Tech Stack:** eCRM Next.js 16 App Router, Prisma 6, PostgreSQL, Vitest, Playwright. EmailVoice FastAPI, SQLModel, Alembic, React/Vite, pytest, Playwright.

---

## Decision Summary

Build the first slice around one core path:

- A meeting or scheduling event created in EmailVoice becomes a workflow event in eCRM.
- That event creates or updates the related CRM record and a follow-up task.
- Both apps can show that event in a shared timeline.

This is the smallest change that makes the two systems feel like one platform rather than two connected products.

---

## Implementation Scope

### Must-build first

1. Cross-app workflow handoff from EmailVoice to eCRM
2. Shared workflow timeline and event model
3. Bidirectional status visibility for reps/admins
4. Rep action layer for follow-up and task creation
5. Basic conversation-to-opportunity intelligence

### Nice-to-have after first slice

6. Web chat/message workflow
7. Teams-style collaboration surface
8. Cross-system reporting dashboards

---

## Parallel Streams

### Stream A: Shared Workflow Contracts

Owner: eCRM backend/data worker.

Can start immediately.

Produces the shared event schema, API contract, and core validation rules used by both apps.

### Stream B: eCRM Workflow Engine

Owner: eCRM backend worker.

Starts after Stream A defines the contract.

Produces the server-side workflow handling for receiving events from EmailVoice and turning them into CRM tasks, updates, and timeline entries.

### Stream C: EmailVoice Event Emission

Owner: EmailVoice backend worker.

Starts after Stream A publishes the contract.

Produces the event emission path for scheduling/booked/meeting/call outcomes so EmailVoice can push meaningful workflow events into eCRM.

### Stream D: Shared Timeline and Rep UI

Owner: eCRM + EmailVoice UI worker.

Starts after Streams A-C have a testable path.

Adds the user-facing timeline, task creation, and next-step surfaces so sales reps can act on the new workflow.

### Stream E: Verification and Acceptance

Owner: cross-repo QA worker.

Adds integration tests proving that an EmailVoice booking results in an eCRM workflow update and a visible event in the user experience.

---

## Stream A Tasks: Shared Workflow Contracts

### Task A1: Add workflow data models in eCRM

**Files:**
- Modify: `C:\My Workspace\eCRM\prisma\schema.prisma`
- Create: `C:\My Workspace\eCRM\src\server\workflow-events\types.ts`
- Create: `C:\My Workspace\eCRM\src\server\workflow-events\validators.ts`

- [ ] Add a new `WorkflowEvent` model to the Prisma schema.
- [ ] Add an optional `WorkflowAction` or `WorkflowTask` model if needed for follow-up generation.
- [ ] Add indexes for `sourceApp`, `entityType`, `entityId`, `relatedRecordId`, and `occurredAt`.
- [ ] Add a Prisma migration and run generation.

Suggested shape for the first slice:

```prisma
model WorkflowEvent {
  id              String   @id @default(cuid())
  sourceApp       String
  sourceEventType String
  entityType      String
  entityId        String?
  relatedRecordType String?
  relatedRecordId String?
  summary         String
  payload         Json
  occurredAt      DateTime @default(now())
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([sourceApp, occurredAt])
  @@index([entityType, entityId])
  @@index([relatedRecordType, relatedRecordId])
}
```

### Task A2: Define the API contract

**Files:**
- Create: `C:\My Workspace\eCRM\src\app\api\workflow-events\route.ts`
- Create: `C:\My Workspace\eCRM\src\server\workflow-events\service.ts`

- [ ] Define the HTTP payload shape for workflow events emitted by EmailVoice.
- [ ] Define event types such as `meeting_booked`, `call_completed`, `follow_up_created`, `proposal_sent`, and `order_progressed`.
- [ ] Add validation and parser helpers.

---

## Stream B Tasks: eCRM Workflow Engine

### Task B1: Receive and persist workflow events

**Files:**
- Create: `C:\My Workspace\eCRM\src\server\workflow-events\ingest.ts`
- Create: `C:\My Workspace\eCRM\src\server\workflow-events\ingest.test.ts`

- [ ] Create an API endpoint that accepts workflow events from EmailVoice.
- [ ] Persist the event in the new workflow event table.
- [ ] Return a success payload with the created event ID.

### Task B2: Convert EmailVoice events into CRM actions

**Files:**
- Create: `C:\My Workspace\eCRM\src\server\workflow-events\handlers.ts`

- [ ] For `meeting_booked`, create or update a follow-up task linked to the related contact/opportunity.
- [ ] For `call_completed`, add an activity note or task summary linked to the related record.
- [ ] For `proposal_sent`, update the related opportunity or activity stream.
- [ ] Keep the workflow generic enough that future event types can be added later.

### Task B3: Add timeline query support

**Files:**
- Create: `C:\My Workspace\eCRM\src\server\workflow-events\queries.ts`
- Modify later: relevant CRM detail pages/components

- [ ] Add server-side queries to fetch a combined timeline for a lead/contact/opportunity.
- [ ] Include event source, timestamp, summary, and payload metadata.

---

## Stream C Tasks: EmailVoice Event Emission

### Task C1: Add workflow event client in EmailVoice

**Files:**
- Create: `C:\Users\K.Ramachandran\eMailVoice\apps\api\app\integrations\ecrm_workflow_events.py`
- Create: `C:\Users\K.Ramachandran\eMailVoice\apps\api\app\integrations\test_ecrm_workflow_events.py`

- [ ] Create a client that can send workflow events to the eCRM API.
- [ ] Add configurable endpoint URL and auth headers.
- [ ] Add retries and graceful failure behavior for event emission.

### Task C2: Emit events for scheduling/bookings

**Files:**
- Modify: `C:\Users\K.Ramachandran\eMailVoice\apps\api\app\domain\scheduling\service.py`
- Modify: `C:\Users\K.Ramachandran\eMailVoice\apps\api\app\api\routes\scheduling.py`

- [ ] When a scheduling request is marked as booked, emit a `meeting_booked` event to eCRM.
- [ ] Include the contact ID, campaign ID, meeting time, and scheduling request ID in the payload.
- [ ] When a link is sent or status changes, emit a corresponding event as well.

### Task C3: Emit events for calls and follow-ups

**Files:**
- Modify relevant voice and outreach service files in `C:\Users\K.Ramachandran\eMailVoice\apps\api\app\domain\`

- [ ] Emit `call_completed` events when call sessions conclude.
- [ ] Emit `follow_up_created` events when a follow-up task or reminder is created.

---

## Stream D Tasks: Shared Timeline and Rep UI

### Task D1: Build the shared timeline surface in eCRM

**Files:**
- Create: `C:\My Workspace\eCRM\src\components\workflow\workflow-timeline.tsx`
- Modify: relevant customer/opportunity detail pages

- [ ] Add a timeline component that shows workflow events from both systems.
- [ ] Group events by time and show source badge, summary, and timestamp.
- [ ] Keep the visual treatment consistent with the existing eCRM shell.

### Task D2: Add a rep action panel

**Files:**
- Create: `C:\My Workspace\eCRM\src\components\workflow\next-actions-panel.tsx`

- [ ] Show the next best action for a contact or opportunity.
- [ ] Offer buttons such as “Create follow-up”, “Open task”, and “View meeting details”.
- [ ] Keep this lightweight for the first slice.

### Task D3: Add EmailVoice UI hook for booking context

**Files:**
- Modify relevant frontend files under `C:\Users\K.Ramachandran\eMailVoice\apps\web\src\`

- [ ] Show the current CRM context in the scheduling page where available.
- [ ] Display whether the booking has already created a workflow update in eCRM.

---

## Stream E Tasks: Verification and Acceptance

### Task E1: Add integration tests

**Files:**
- Create: `C:\My Workspace\eCRM\tests\e2e\workflow-handoff.spec.ts`
- Create: `C:\Users\K.Ramachandran\eMailVoice\apps\api\tests\integration\test_workflow_events.py`

- [ ] Add a test covering: booking in EmailVoice → event emitted → eCRM receives event → follow-up task appears.
- [ ] Add a UI-level expectation that the timeline shows the new event.

### Task E2: Acceptance criteria

- [ ] A scheduling request marked as booked in EmailVoice creates a follow-up or workflow entry in eCRM.
- [ ] The related contact/opportunity shows the event in a shared timeline.
- [ ] Reps can see the new event without switching apps.
- [ ] The flow is resilient to API failures and logs the event for retry later.

---

## Suggested Delivery Order

1. Add workflow event schema and API contract.
2. Build eCRM ingestion and task conversion.
3. Emit booking and call events from EmailVoice.
4. Add the shared timeline and action panel.
5. Add integration tests and polish.

---

## Definition of Done

The graphic is considered matched at the workflow level when:

- EmailVoice engagement actions create actual CRM workflow state,
- reps can see a unified timeline of customer progress,
- and the system behaves like one connected operating layer rather than two separate products.
