import { randomUUID } from "node:crypto";
import type { DestinationProvider, IntegrationDeliveryRepository, ProjectionStream, RepairCandidate } from "./outbox";

export async function reconcileCellProjection(
  cellId: string,
  destinationInstallation: string,
  repository: IntegrationDeliveryRepository,
  provider: Pick<DestinationProvider, "checkpoint">,
  context: { actorId: string; correlationId: string; reason: string; now: Date; stream?: ProjectionStream }
) {
  const stream = context.stream ?? "SHARED_RECORD";
  const [source, destination] = await Promise.all([
    repository.sourceState(cellId, stream),
    provider.checkpoint(destinationInstallation, stream)
  ]);
  await repository.saveReconciliation(cellId, destinationInstallation, stream, source, destination, context.now);
  const matched = source.count === destination.count && source.version === destination.version && source.checkpoint === destination.checkpoint;
  if (matched) {
    await repository.resolveRepairCandidates(cellId, destinationInstallation, stream, {
      id: `audit_${randomUUID()}`, actorId: context.actorId, action: "integration-projection.repair-resolved",
      targetId: `${cellId}:${destinationInstallation}:${stream}`, correlationId: context.correlationId,
      reason: context.reason, result: "SUCCEEDED", occurredAt: context.now
    });
    return { matched: true, stream, sourceCount: source.count, destinationCount: destination.count, sourceVersion: source.version, destinationVersion: destination.version, repairCandidateCreated: false };
  }
  const candidate: RepairCandidate = {
    id: `repair_${randomUUID()}`, cellId, destinationInstallation, stream, sourceCount: source.count, destinationCount: destination.count,
    sourceVersion: source.version, destinationVersion: destination.version,
    sourceCheckpoint: source.checkpoint, destinationCheckpoint: destination.checkpoint, status: "OPEN",
    correlationId: context.correlationId, reason: context.reason, createdAt: context.now
  };
  const resolvedCandidate = await repository.saveRepairCandidate(candidate, {
    id: `audit_${randomUUID()}`, actorId: context.actorId, action: "integration-projection.reconciliation-mismatch",
    correlationId: context.correlationId, reason: context.reason, result: "FAILED",
    error: "CHECKPOINT_OR_COUNT_MISMATCH", occurredAt: context.now
  });
  return {
    matched: false, stream, sourceCount: source.count, destinationCount: destination.count,
    sourceVersion: source.version, destinationVersion: destination.version,
    repairCandidateId: resolvedCandidate.id, repairCandidateCreated: resolvedCandidate.id === candidate.id
  };
}

export async function reconcileCellProjectionStreams(
  cellId: string,
  destinationInstallation: string,
  repository: IntegrationDeliveryRepository,
  provider: Pick<DestinationProvider, "checkpoint">,
  context: { actorId: string; correlationId: string; reason: string; now: Date }
) {
  const results = [];
  for (const stream of ["SHARED_RECORD", "WORKFLOW_EVENT"] as const) {
    results.push(await reconcileCellProjection(cellId, destinationInstallation, repository, provider, { ...context, stream }));
  }
  return results;
}
