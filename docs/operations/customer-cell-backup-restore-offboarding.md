# Customer-cell backup, restore, and offboarding

## Backup and restore

Verify the backup reference is recorded for the target cell and retention policy. Restore into isolated infrastructure for that same immutable `cellId`/`cellKey`; reject a reference owned by another cell. Validate database/schema identity, storage prefix, application health, initial/local Admin access, integration credential references, projection checkpoints, and audit continuity before cutover. Reconcile SignalLoop and RevenueOS for only the restored workspace. Do not use another tenant's data to test restore.

## Offboarding

1. Suspend first and verify immediate denial plus signed projection acknowledgement.
2. Export customer-owned data under the retention policy; record digest and evidence reference without business payloads in platform audit.
3. Revoke support grants and integration credentials. Drain or explicitly disposition outbox/dead-letter and repair candidates.
4. Move to `OFFBOARDING`; retain backup/restore evidence until approved deletion time.
5. Destroy only with provider fencing/idempotency and dual-checked target identity. Mark `DELETED` only after provider confirmation and required audit evidence.

The local driver does not prove cloud backup, restore, deletion, or legal-retention execution. Real provider verification requires selected vendor endpoints, credentials, deployment authority, and an approved non-customer rehearsal.
