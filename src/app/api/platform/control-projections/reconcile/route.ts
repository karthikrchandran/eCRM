import { randomUUID } from "node:crypto";

import { z } from "zod";

import { authorizePlatformAdmin, type PlatformAdministrator } from "@/server/platform/admin-auth";
import type {
  ControlProjectionReconciliationOptions,
  ControlProjectionReconciliationResult
} from "@/server/platform/administration";
import { getPlatformAdministrationService } from "@/server/platform/runtime";

const requestSchema = z.object({
  batchSize: z.number().int().min(1).max(100).optional(),
  maxAttempts: z.number().int().min(1).max(100).optional(),
  leaseDurationMs: z.number().int().min(1_000).max(300_000).optional(),
  baseBackoffMs: z.number().int().min(1).max(3_600_000).optional()
});

type Dependencies = {
  authorize(request: Request): PlatformAdministrator | Response;
  reconcile(options: ControlProjectionReconciliationOptions): Promise<ControlProjectionReconciliationResult>;
  createWorkerId?(): string;
};

export function createControlProjectionReconciliationHandler(dependencies: Dependencies) {
  return async (request: Request): Promise<Response> => {
    const administrator = dependencies.authorize(request);
    if (administrator instanceof Response) return administrator;
    try {
      const input = requestSchema.parse(await request.json().catch(() => ({})));
      return Response.json(await dependencies.reconcile({
        ...input,
        workerId: dependencies.createWorkerId?.() ?? `projection-route-${randomUUID()}`
      }));
    } catch (error) {
      if (error instanceof z.ZodError) {
        return Response.json({ error: "Invalid reconciliation request." }, { status: 400 });
      }
      return Response.json({ error: "Unable to reconcile control projections." }, { status: 500 });
    }
  };
}

const handler = createControlProjectionReconciliationHandler({
  authorize: (request) => authorizePlatformAdmin(request),
  reconcile: (options) => getPlatformAdministrationService().reconcileControlProjections(options)
});

export const POST = handler;
