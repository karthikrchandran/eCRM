import { z } from "zod";

import { authorizeCellAdmin } from "@/server/cell-admin/authorization";
import { getCellAdministrationService } from "@/server/cell-admin/runtime";
import type { CellAdminActor, LocalUserRecord } from "@/server/cell-admin/service";
import { getServerEnv } from "@/server/env";

const createSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().email(),
  password: z.string().min(12),
  role: z.enum(["ADMIN", "SALES"]),
  correlationId: z.string().trim().min(1),
  reason: z.string().trim().min(1)
});

type Authorization = { user: CellAdminActor; cellId: string; cellKey: string };
type Dependencies = {
  authorize(): Promise<Authorization | Response>;
  listUsers(user: CellAdminActor): Promise<LocalUserRecord[]>;
  createUser(user: CellAdminActor, input: { name: string; email: string; password: string; role: "ADMIN" | "SALES" }, context: { correlationId: string; reason: string }): Promise<LocalUserRecord>;
};

export function createLocalUserCollectionHandlers(dependencies: Dependencies) {
  return {
    GET: async (request: Request) => {
      void request;
      const authorization = await dependencies.authorize();
      if (authorization instanceof Response) return authorization;
      return Response.json({ users: await dependencies.listUsers(authorization.user) });
    },
    POST: async (request: Request) => {
      const authorization = await dependencies.authorize();
      if (authorization instanceof Response) return authorization;
      try {
        const { correlationId, reason, ...input } = createSchema.parse(await request.json());
        const user = await dependencies.createUser(authorization.user, input, { correlationId, reason });
        return Response.json({ user }, { status: 201 });
      } catch (error) {
        if (error instanceof z.ZodError || error instanceof SyntaxError) return Response.json({ error: "Invalid local user." }, { status: 400 });
        return Response.json({ error: error instanceof Error ? error.message : "Local user creation rejected." }, { status: 409 });
      }
    }
  };
}

const handlers = createLocalUserCollectionHandlers({
  authorize: () => authorizeCellAdmin(getServerEnv().runtime),
  listUsers: (user) => getCellAdministrationService().listUsers(user),
  createUser: (user, input, context) => getCellAdministrationService().createUser(user, input, context)
});

export const GET = handlers.GET;
export const POST = handlers.POST;
