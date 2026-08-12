import { randomUUID } from "node:crypto";
import type { DestinationProvider, IntegrationDeliveryRepository, RepairCandidate } from "./outbox";

export async function reconcileCellProjection(
  cellId: string,
  destinationInstallation: string,
  repository: IntegrationDeliveryRepository,
  provider: Pick<DestinationProvider, "checkpoint">,
  context: { actorId: string; correlationId: string; reason: string; now: Date }
) {
  const [source, destination] = await Promise.all([
    repository.sourceState(cellId),
    provider.checkpoint(destinationInstallation)
  ]);
  await repository.saveReconciliation(cellId, destinationInstallation, source, destination, context.now);
  const matched = source.count === destination.count && source.checkpoint === destination.checkpoint;
  if (matched) return { matched: true, sourceCount: source.count, destinationCount: destination.count, repairCandidateCreated: false };
  const candidate: RepairCandidate = {
    id: `repair_${randomUUID()}`, cellId, destinationInstallation, sourceCount: source.count, destinationCount: destination.count,
    sourceCheckpoint: source.checkpoint, destinationCheckpoint: destination.checkpoint, status: "OPEN",
    correlationId: context.correlationId, reason: context.reason, createdAt: context.now
  };
  await repository.saveRepairCandidate(candidate, {
    id: `audit_${randomUUID()}`, actorId: context.actorId, action: "integration-projection.reconciliation-mismatch",
    targetId: candidate.id, correlationId: context.correlationId, reason: context.reason, result: "FAILED",
    error: "CHECKPOINT_OR_COUNT_MISMATCH", occurredAt: context.now
  });
  return { matched: false, sourceCount: source.count, destinationCount: destination.count, repairCandidateCreated: true };
}
