import { z } from "zod";

import { authorizePlatformAdmin, type PlatformAdministrator } from "@/server/platform/admin-auth";
import type { PlatformAuditCommand } from "@/server/platform/administration";
import { getPlatformAdministrationService } from "@/server/platform/runtime";
import type { CustomerCellRecord } from "@/server/platform/types";

const transitionSchema = z.object({
  status: z.enum(["ACTIVE", "SUSPENDED", "OFFBOARDING"]),
  correlationId: z.string().trim().min(1),
  reason: z.string().trim().min(1)
});

const deletionSchema = z.object({
  correlationId: z.string().trim().min(1),
  reason: z.string().trim().min(1),
  retentionEvidence: z.string().trim().min(1),
  backupEvidence: z.string().trim().min(1)
});

type RouteContext = { params: Promise<{ cellId: string }> };
type Dependencies = {
  authorize(request: Request): PlatformAdministrator | Response;
  transitionCell(cellId: string, status: "ACTIVE" | "SUSPENDED" | "OFFBOARDING", command: PlatformAuditCommand): Promise<CustomerCellRecord>;
  deleteCell(cellId: string, command: PlatformAuditCommand & { retentionEvidence: string; backupEvidence: string }): Promise<CustomerCellRecord>;
};

export function createCellItemHandlers(dependencies: Dependencies) {
  return {
    PATCH: async (request: Request, context: RouteContext) => {
      const administrator = dependencies.authorize(request);
      if (administrator instanceof Response) return administrator;
      try {
        const body = transitionSchema.parse(await request.json());
        const { cellId } = await context.params;
        const cell = await dependencies.transitionCell(cellId, body.status, { ...body, actor: administrator.actor });
        return Response.json({ cell });
      } catch (error) {
        if (error instanceof z.ZodError || error instanceof SyntaxError) return Response.json({ error: "Invalid lifecycle request." }, { status: 400 });
        if (error instanceof Error && error.message.includes("not found")) return Response.json({ error: "Customer cell was not found." }, { status: 404 });
        return Response.json({ error: error instanceof Error ? error.message : "Lifecycle transition rejected." }, { status: 409 });
      }
    },
    DELETE: async (request: Request, context: RouteContext) => {
      const administrator = dependencies.authorize(request);
      if (administrator instanceof Response) return administrator;
      try {
        const body = deletionSchema.parse(await request.json());
        const { cellId } = await context.params;
        const cell = await dependencies.deleteCell(cellId, { ...body, actor: administrator.actor });
        return Response.json({ cell });
      } catch (error) {
        if (error instanceof z.ZodError || error instanceof SyntaxError) return Response.json({ error: "Deletion evidence is required." }, { status: 400 });
        if (error instanceof Error && error.message.includes("not found")) return Response.json({ error: "Customer cell was not found." }, { status: 404 });
        return Response.json({ error: error instanceof Error ? error.message : "Cell deletion rejected." }, { status: 409 });
      }
    }
  };
}

const handlers = createCellItemHandlers({
  authorize: (request) => authorizePlatformAdmin(request),
  transitionCell: (cellId, status, command) => getPlatformAdministrationService().transitionCell(cellId, status, command),
  deleteCell: (cellId, command) => getPlatformAdministrationService().deleteCell(cellId, command)
});

export const PATCH = handlers.PATCH;
export const DELETE = handlers.DELETE;
