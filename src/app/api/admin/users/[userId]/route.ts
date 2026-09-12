import { z } from "zod";

import { authorizeCellAdmin } from "@/server/cell-admin/authorization";
import { getCellAdministrationService } from "@/server/cell-admin/runtime";
import type { CellAdminActor, LocalUserRecord } from "@/server/cell-admin/service";
import { getServerEnv } from "@/server/env";

const updateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  role: z.enum(["ADMIN", "SALES"]).optional(),
  active: z.boolean().optional(),
  correlationId: z.string().trim().min(1),
  reason: z.string().trim().min(1)
});
type RouteContext = { params: Promise<{ userId: string }> };
type Authorization = { user: CellAdminActor; cellId: string; cellKey: string };
type Dependencies = {
  authorize(): Promise<Authorization | Response>;
  updateUser(user: CellAdminActor, userId: string, update: Partial<Pick<LocalUserRecord, "name" | "role" | "active">>, context: { correlationId: string; reason: string }): Promise<LocalUserRecord>;
};

export function createLocalUserItemHandlers(dependencies: Dependencies) {
  return {
    PATCH: async (request: Request, routeContext: RouteContext) => {
      const authorization = await dependencies.authorize();
      if (authorization instanceof Response) return authorization;
      try {
        const { correlationId, reason, ...update } = updateSchema.parse(await request.json());
        const { userId } = await routeContext.params;
        const user = await dependencies.updateUser(authorization.user, userId, update, { correlationId, reason });
        return Response.json({ user });
      } catch (error) {
        if (error instanceof z.ZodError || error instanceof SyntaxError) return Response.json({ error: "Invalid local user update." }, { status: 400 });
        if (error instanceof Error && error.message.includes("not found")) return Response.json({ error: error.message }, { status: 404 });
        return Response.json({ error: error instanceof Error ? error.message : "Local user update rejected." }, { status: 409 });
      }
    }
  };
}

const handlers = createLocalUserItemHandlers({
  authorize: () => authorizeCellAdmin(getServerEnv().runtime),
  updateUser: (user, userId, update, context) => getCellAdministrationService().updateUser(user, userId, update, context)
});

export const PATCH = handlers.PATCH;
