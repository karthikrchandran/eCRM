import { z } from "zod";

import { authorizePlatformAdmin, type PlatformAdministrator } from "@/server/platform/admin-auth";
import { getCustomerCellProvisioner, getPlatformAdministrationService } from "@/server/platform/runtime";
import type { ProvisioningOutcome } from "@/server/platform/provisioning";
import type { ProvisioningRequest, CustomerCellRecord } from "@/server/platform/types";

const provisioningSchema = z.object({
  cellId: z.string().trim().min(1),
  cellKey: z.string().regex(/^[a-z0-9-]+$/),
  legalName: z.string().trim().min(1),
  displayName: z.string().trim().min(1),
  region: z.string().trim().min(1),
  desiredSubdomain: z.string().regex(/^[a-z0-9-]+$/),
  planCode: z.string().regex(/^[A-Z][A-Z0-9_-]{1,31}$/),
  allowedModules: z.array(z.string().regex(/^[a-z][a-z0-9-]{0,31}$/)).max(50)
    .refine((modules) => new Set(modules).size === modules.length),
  initialAdminEmail: z.string().email(),
  idempotencyKey: z.string().trim().min(1),
  correlationId: z.string().trim().min(1),
  reason: z.string().trim().min(1)
});

type Dependencies = {
  authorize(request: Request): PlatformAdministrator | Response;
  listCells(): Promise<CustomerCellRecord[] | unknown[]>;
  provision(request: ProvisioningRequest): Promise<ProvisioningOutcome | unknown>;
};

export function createCellCollectionHandlers(dependencies: Dependencies) {
  return {
    GET: async (request: Request) => {
      const administrator = dependencies.authorize(request);
      if (administrator instanceof Response) return administrator;
      try {
        return Response.json({ cells: await dependencies.listCells() });
      } catch {
        return Response.json({ error: "Unable to list customer cells." }, { status: 500 });
      }
    },
    POST: async (request: Request) => {
      const administrator = dependencies.authorize(request);
      if (administrator instanceof Response) return administrator;
      try {
        const parsed = provisioningSchema.parse(await request.json());
        const outcome = await dependencies.provision({ ...parsed, actor: administrator.actor });
        const result = outcome as ProvisioningOutcome;
        return Response.json(outcome, { status: result.attempt?.result === "FAILED" ? 502 : 201 });
      } catch (error) {
        if (error instanceof z.ZodError || error instanceof SyntaxError) {
          return Response.json({ error: "Invalid customer-cell request." }, { status: 400 });
        }
        return Response.json({ error: "Unable to provision customer cell." }, { status: 500 });
      }
    }
  };
}

const handlers = createCellCollectionHandlers({
  authorize: (request) => authorizePlatformAdmin(request),
  listCells: () => getPlatformAdministrationService().listCells(),
  provision: (request) => getCustomerCellProvisioner().provision(request)
});

export const GET = handlers.GET;
export const POST = handlers.POST;
