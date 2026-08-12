import { z } from "zod";

import { authorizeCellAdmin } from "@/server/cell-admin/authorization";
import { getCellAdministrationService } from "@/server/cell-admin/runtime";
import type { CellAdminActor, CellConfigurationRecord } from "@/server/cell-admin/service";
import { getServerEnv } from "@/server/env";

const publicHttpsUrl = z.union([z.literal(""), z.string().url().refine((value) => {
  const url = new URL(value);
  const host = url.hostname.toLowerCase();
  return url.protocol === "https:" && !url.username && !url.password
    && host !== "localhost" && host !== "127.0.0.1" && host !== "::1" && host !== "169.254.169.254"
    && !host.startsWith("10.") && !host.startsWith("192.168.") && !/^172\.(1[6-9]|2\d|3[01])\./.test(host);
}, "URL must use public HTTPS")]);

const updateSchema = z.object({
  displayName: z.string().trim().min(1).optional(),
  logoUrl: z.union([z.string().url(), z.literal("")]).optional(),
  supportUrl: publicHttpsUrl.optional(),
  legalUrl: publicHttpsUrl.optional(),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  locale: z.string().trim().min(2).optional(),
  timezone: z.string().trim().min(1).optional(),
  defaultCurrency: z.enum(["INR", "USD"]).optional(),
  enabledModules: z.array(z.string().regex(/^[a-z0-9-]+$/)).optional(),
  revision: z.number().int().min(0),
  correlationId: z.string().trim().min(1),
  reason: z.string().trim().min(1)
});

type Authorization = { user: CellAdminActor; cellId: string; cellKey: string };
type ConfigurationUpdate = Partial<Pick<CellConfigurationRecord, "displayName" | "logoUrl" | "supportUrl" | "legalUrl" | "primaryColor" | "locale" | "timezone" | "defaultCurrency" | "enabledModules">>;
type Dependencies = {
  authorize(): Promise<Authorization | Response>;
  getConfiguration(user: CellAdminActor): Promise<CellConfigurationRecord | unknown>;
  updateConfiguration(user: CellAdminActor, update: ConfigurationUpdate, context: { correlationId: string; reason: string; expectedRevision?: number }): Promise<CellConfigurationRecord | unknown>;
};

export function createCellConfigurationHandlers(dependencies: Dependencies) {
  return {
    GET: async (request: Request) => {
      void request;
      const authorization = await dependencies.authorize();
      if (authorization instanceof Response) return authorization;
      return Response.json({ configuration: await dependencies.getConfiguration(authorization.user) });
    },
    PATCH: async (request: Request) => {
      const authorization = await dependencies.authorize();
      if (authorization instanceof Response) return authorization;
      try {
        const { correlationId, reason, revision, ...update } = updateSchema.parse(await request.json());
        const configuration = await dependencies.updateConfiguration(authorization.user, update, { correlationId, reason, expectedRevision: revision });
        return Response.json({ configuration });
      } catch (error) {
        if (error instanceof z.ZodError || error instanceof SyntaxError) return Response.json({ error: "Invalid cell configuration." }, { status: 400 });
        return Response.json({ error: error instanceof Error ? error.message : "Configuration update rejected." }, { status: 409 });
      }
    }
  };
}

const handlers = createCellConfigurationHandlers({
  authorize: () => authorizeCellAdmin(getServerEnv().runtime),
  getConfiguration: (user) => getCellAdministrationService().getConfiguration(user),
  updateConfiguration: (user, update, context) => getCellAdministrationService().updateConfiguration(user, update, context)
});

export const GET = handlers.GET;
export const PATCH = handlers.PATCH;
