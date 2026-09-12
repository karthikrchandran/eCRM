# Customer-cell delivery, replay, and reconciliation

The source mutation and its integration outbox entry must commit together. Workers claim only their deployment-derived `cellId`, hold a fenced renewable lease, and deliver only the configured destination installation. A durable matching acknowledgement is required before `DELIVERED`.

## Failure response

1. Inspect cell-scoped status, failed/dead-letter counts, circuit state, and safe error codes.
2. Allow bounded exponential retry. A timeout or ambiguous acknowledgement must first query the destination by idempotency key. Circuit opening defers work; a single fenced half-open probe decides recovery.
3. After exhaustion, record the incident and repair the cause. Replay only the named cell's dead letter with an operator ID and non-empty reason. Replay reuses the original idempotency identity.
4. Run reconciliation for both `SHARED_RECORD` and `WORKFLOW_EVENT`. A count/version/checkpoint mismatch creates an auditable repair candidate; it never silently rewrites either system.

Wrong credential, cell, workspace, capability, stale version, or conflicting replay is a terminal security/contract failure, not a retryable outage. Never move an outbox row or repair candidate between cells.

See `npm run worker:integration-delivery` and `npm run reconcile:integration-delivery`. Synthetic tests make no external/provider calls; real SignalLoop/RevenueOS endpoint and API-key activation remains unperformed and must fail closed when absent.
