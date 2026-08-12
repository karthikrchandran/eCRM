import { z } from "zod";

import { authorizePlatformAdmin, type PlatformAdministrator } from "@/server/platform/admin-auth";
import type { PlatformAdministrationService } from "@/server/platform/administration";
import { getPlatformAdministrationService } from "@/server/platform/runtime";
import { issueSupportAccessToken } from "@/server/cell-admin/support-access";

const supportGrantSchema = z.object({
  cellId: z.string().trim().min(1),
  operatorId: z.string().trim().min(1),
  caseReference: z.string().trim().min(1),
  capabilities: z.array(z.enum(["configuration:read", "users:read"])).min(1),
  reason: z.string().trim().min(1),
  expiresAt: z.coerce.date(),
  correlationId: z.string().trim().min(1)
});

type GrantInput = Parameters<PlatformAdministrationService["createSupportGrant"]>[0];
type Dependencies = {
  authorize(request: Request): PlatformAdministrator | Response;
  createSupportGrant(input: GrantInput): ReturnType<PlatformAdministrationService["createSupportGrant"]>;
  issueAccessToken(grant: Awaited<ReturnType<PlatformAdministrationService["createSupportGrant"]>>): Promise<string>;
};

export function createSupportGrantCollectionHandlers(dependencies: Dependencies) {
  return {
    POST: async (request: Request) => {
      const administrator = dependencies.authorize(request);
      if (administrator instanceof Response) return administrator;
      try {
        const body = supportGrantSchema.parse(await request.json());
        const grant = await dependencies.createSupportGrant({ ...body, actor: administrator.actor });
        const accessToken = await dependencies.issueAccessToken(grant);
        return Response.json({ grant, accessToken }, { status: 201 });
      } catch (error) {
        if (error instanceof z.ZodError || error instanceof SyntaxError) return Response.json({ error: "Invalid support grant." }, { status: 400 });
        return Response.json({ error: error instanceof Error ? error.message : "Unable to create support grant." }, { status: 409 });
      }
    }
  };
}

const handlers = createSupportGrantCollectionHandlers({
  authorize: (request) => authorizePlatformAdmin(request),
  createSupportGrant: (input) => getPlatformAdministrationService().createSupportGrant(input),
  issueAccessToken: (grant) => issueSupportAccessToken(grant, process.env.SUPPORT_ACCESS_SECRET ?? "")
});

export const POST = handlers.POST;
