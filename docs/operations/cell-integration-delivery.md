# Customer-cell integration delivery operations

Run these commands inside one configured eCRM customer-cell deployment. The deployment supplies `APP_MODE=cell`, immutable `CELL_ID`/`CELL_KEY`, the cell database, and the server-owned destination installation. Never pass a cell identifier or destination in an HTTP request.

## Credential operations

An active local Admin manages credentials in **Admin > Settings > Integration delivery** or `/api/admin/integrations`. Issue and rotate responses show a generated secret once. Only a bcrypt hash, capabilities, status, expiry, rotation/revocation timestamps, last-use time, and payload-free audit metadata are retained.

The legacy `SHARED_DATA_API_TOKEN` works only when both `NODE_ENV=development` and `ALLOW_LEGACY_SHARED_DATA_TOKEN=true`. Production rejects it unconditionally.

## Deliver one queued event

Apply the cell migration and run one worker iteration:

```powershell
npm run prisma:migrate
npm run worker:integration-delivery
```

The worker claims one due record with a lease and fencing token. It commits `DELIVERED` only after a remote acknowledgement. Retry delay is bounded exponential backoff with jitter. Exhausted records become `DEAD_LETTER`; replay requires an Admin-supplied reason and creates audit evidence.

For SignalLoop, configure `INTEGRATION_DESTINATION_URL` as its HTTPS origin,
`INTEGRATION_DESTINATION_INSTALLATION` as the exact bound SignalLoop workspace
ID, and `INTEGRATION_DESTINATION_TOKEN` as the credential resolved by that
binding's allowlisted secret reference. The provider posts only to
`/api/v1/ecrm-installations/deliveries`. It sends deployment-owned `CELL_ID` and
`CELL_KEY`, the configured workspace, correlation ID, and idempotency key as
headers; SignalLoop rejects any value that does not match the persisted binding.
The checked-in example and ACK live at
`docs/contracts/signalloop-ecrm-installation-delivery-v1.json`.

Schedule the one-shot command in the deployment scheduler. This repository does not install a recurring schedule. Concurrent invocations are safe because claims and acknowledgements use compare-and-swap fencing.

## Reconcile projections

```powershell
$env:INTEGRATION_OPERATOR_ID="operator@example.com"
$env:INTEGRATION_RECONCILIATION_REASON="Daily checkpoint comparison"
npm run reconcile:integration-delivery
```

The SignalLoop delivery credential has no workspace-admin checkpoint authority.
The HTTP provider therefore fails closed with
`CHECKPOINT_CONTRACT_UNAVAILABLE`; run reconciliation through SignalLoop's
authenticated workspace-admin operation until a separately authorized
machine-to-machine checkpoint contract is introduced. It never falls back to a
legacy or guessed route.

## Incident and replay procedure

1. Open **Admin > Settings > Integration delivery** and confirm failed/dead-letter counts, checkpoint, and open repair candidates.
2. Restore destination health or credentials before replay.
3. Replay the specific dead letter with a concrete operator reason.
4. Run `npm run worker:integration-delivery` until the queue drains.
5. Run `npm run reconcile:integration-delivery` and confirm counts/checkpoints match.
6. Preserve audit and delivery-attempt records for the incident review. Audit records contain no integration secret or business payload.
