# Customer-cell suspension and support

## Suspend or resume

Record actor, reason, case/correlation ID, and expected current status. Suspension follows `ACTIVE -> SUSPENDING -> SUSPENDED`: the platform remains non-active until the cell durably acknowledges the signed lifecycle projection. Cell authorization must deny customer and integration work immediately from projected `SUSPENDED` state. Resume follows the same durable acknowledgement path and never skips reconciliation after an ambiguous response.

If delivery fails, inspect the pending control projection. Retry the same idempotency key; do not create a replacement lifecycle command. Use the reconciliation worker after a crash between remote acknowledgement and local finalization.

## Grant support access

Create a short-lived grant for one cell, one operator, one case reference, and the minimum supported capability. Deliver its signed projection before issuing a support token. Every access attempt is audited. Tokens and grants are denied when the cell is not active, before `startsAt`, at/after `expiresAt`, after revocation, for another cell/operator/case, or for an ungranted capability.

Revoke immediately when the case ends. Reconcile the same revocation projection if acknowledgement is ambiguous. Never extend a grant by changing its expiry; create a separately approved grant.
