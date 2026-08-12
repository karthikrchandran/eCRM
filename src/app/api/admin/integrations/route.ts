import { z } from "zod";

import { authorizeCellAdmin } from "@/server/cell-admin/authorization";
import { requireCellModule } from "@/server/cell-admin/module-access";
import { getServerEnv } from "@/server/env";
import { integrationCapabilities, type IntegrationCapability } from "@/server/integration-delivery/credentials";
import { configuredDestinationProvider } from "@/server/integration-delivery/provider";
import { reconcileCellProjectionStreams } from "@/server/integration-delivery/reconciliation";
import { getIntegrationCredentialService, getIntegrationDeliveryRepository } from "@/server/integration-delivery/runtime";

type Actor = { id: string; role: "ADMIN" | "SALES" };
type Authorization = { user: Actor; cellId: string; cellKey: string };

const issueSchema = z.object({
  action: z.literal("issue"), name: z.string().trim().min(1),
  capabilities: z.array(z.enum(integrationCapabilities)).min(1), expiresAt: z.coerce.date(),
  correlationId: z.string().trim().min(1), reason: z.string().trim().min(1)
});
const replaySchema = z.object({ action: z.literal("replay"), outboxId: z.string().trim().min(1), reason: z.string().trim().min(1) });
const reconcileSchema = z.object({ action: z.literal("reconcile"), correlationId: z.string().trim().min(1), reason: z.string().trim().min(1) });
const rotateSchema = z.object({ action: z.literal("rotate"), credentialId: z.string().trim().min(1), expiresAt: z.coerce.date(), correlationId: z.string().trim().min(1), reason: z.string().trim().min(1) });
const revokeSchema = z.object({ action: z.literal("revoke"), credentialId: z.string().trim().min(1), correlationId: z.string().trim().min(1), reason: z.string().trim().min(1) });
const actionSchema = z.discriminatedUnion("action", [issueSchema, replaySchema, reconcileSchema, rotateSchema, revokeSchema]);

type Dependencies = {
  authorize(): Promise<Authorization | Response>;
  requireModule(): Promise<void>;
  list(actor: Actor): Promise<unknown>;
  issue(actor: Actor, input: { name: string; capabilities: IntegrationCapability[]; expiresAt: Date; correlationId: string; reason: string }): Promise<unknown>;
  rotate?(actor: Actor, credentialId: string, input: { expiresAt: Date; correlationId: string; reason: string }): Promise<unknown>;
  revoke?(actor: Actor, credentialId: string, input: { correlationId: string; reason: string }): Promise<void>;
  status(cellId: string): Promise<unknown>;
  deadLetters(cellId: string): Promise<Array<{ id: string; attempts: number; errorCode: string | null; updatedAt?: Date }>>;
  repairCandidates(cellId: string): Promise<Array<Record<string, unknown>>>;
  replay(cellId: string, id: string, actorId: string, reason: string, now: Date): Promise<void>;
  reconcile(authorization: Authorization, context: { correlationId: string; reason: string }): Promise<unknown>;
};

export function createIntegrationAdminHandlers(dependencies: Dependencies) {
  async function authorize() {
    const authorization = await dependencies.authorize();
    if (authorization instanceof Response) return authorization;
    try { await dependencies.requireModule(); } catch { return Response.json({ error: "Integration module is not enabled." }, { status: 403 }); }
    return authorization;
  }
  return {
    GET: async (request: Request) => {
      void request;
      const authorization = await authorize();
      if (authorization instanceof Response) return authorization;
      const [credentials, status, deadLetters, repairCandidates] = await Promise.all([
        dependencies.list(authorization.user), dependencies.status(authorization.cellId),
        dependencies.deadLetters(authorization.cellId), dependencies.repairCandidates(authorization.cellId)
      ]);
      return Response.json({
        credentials, status,
        deadLetters: deadLetters.map(({ id, attempts, errorCode, updatedAt }) => ({ id, attempts, errorCode, updatedAt })),
        repairCandidates: repairCandidates.map(({ id, status: repairStatus, sourceCount, destinationCount, sourceCheckpoint, destinationCheckpoint, createdAt }) => ({
          id, status: repairStatus, sourceCount, destinationCount, sourceCheckpoint, destinationCheckpoint, createdAt
        }))
      });
    },
    POST: async (request: Request) => {
      const authorization = await authorize();
      if (authorization instanceof Response) return authorization;
      try {
        const input = actionSchema.parse(await request.json());
        if (input.action === "issue") return Response.json(await dependencies.issue(authorization.user, input), { status: 201 });
        if (input.action === "rotate") {
          if (!dependencies.rotate) throw new Error("Credential rotation is unavailable");
          return Response.json(await dependencies.rotate(authorization.user, input.credentialId, input));
        }
        if (input.action === "revoke") {
          if (!dependencies.revoke) throw new Error("Credential revocation is unavailable");
          await dependencies.revoke(authorization.user, input.credentialId, input);
          return new Response(null, { status: 204 });
        }
        if (input.action === "replay") {
          await dependencies.replay(authorization.cellId, input.outboxId, authorization.user.id, input.reason, new Date());
          return Response.json({ replayed: true });
        }
        return Response.json(await dependencies.reconcile(authorization, input));
      } catch (error) {
        if (error instanceof z.ZodError || error instanceof SyntaxError) return Response.json({ error: "Invalid integration administration request." }, { status: 400 });
        return Response.json({ error: error instanceof Error ? error.message : "Integration administration failed." }, { status: 409 });
      }
    }
  };
}

const handlers = createIntegrationAdminHandlers({
  authorize: () => authorizeCellAdmin(getServerEnv().runtime),
  requireModule: () => requireCellModule("crm"),
  list: (actor) => getIntegrationCredentialService().list(actor),
  issue: (actor, input) => getIntegrationCredentialService().issue(actor, input),
  rotate: (actor, id, input) => getIntegrationCredentialService().rotate(actor, id, input),
  revoke: (actor, id, input) => getIntegrationCredentialService().revoke(actor, id, input),
  status: (cellId) => getIntegrationDeliveryRepository().status(cellId),
  deadLetters: (cellId) => getIntegrationDeliveryRepository().deadLetters(cellId),
  repairCandidates: (cellId) => getIntegrationDeliveryRepository().repairCandidates(cellId),
  replay: (cellId, id, actorId, reason, now) => getIntegrationDeliveryRepository().replay(cellId, id, actorId, reason, now),
  reconcile: (authorization, context) => reconcileCellProjectionStreams(
    authorization.cellId,
    process.env.INTEGRATION_DESTINATION_INSTALLATION ?? "",
    getIntegrationDeliveryRepository(),
    configuredDestinationProvider(),
    { actorId: authorization.user.id, ...context, now: new Date() }
  )
});

export const GET = handlers.GET;
export const POST = handlers.POST;
