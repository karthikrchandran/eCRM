import { getCurrentUser } from "@/server/auth/current-user";
import type { RuntimeConfig } from "@/server/runtime/cell-config";

type LocalUser = { id: string; role: "ADMIN" | "SALES" };

export async function authorizeCellAdmin(
  runtime: RuntimeConfig,
  resolveUser: () => Promise<LocalUser | null> = getCurrentUser
): Promise<{ user: LocalUser; cellId: string; cellKey: string } | Response> {
  if (runtime.mode !== "cell") return Response.json({ error: "Not found." }, { status: 404 });
  const user = await resolveUser();
  if (!user) return Response.json({ error: "Unauthorized." }, { status: 401 });
  if (user.role !== "ADMIN") return Response.json({ error: "Forbidden." }, { status: 403 });
  return { user, cellId: runtime.cellId, cellKey: runtime.cellKey };
}
