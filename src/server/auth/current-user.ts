import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/server/db";
import { isConfiguredCellRuntimeActive } from "@/server/runtime/cell-config";
import { requireCellModule, type CellModule } from "@/server/cell-admin/module-access";
import { SESSION_COOKIE_NAME, verifySessionToken } from "./session";

export async function getCurrentUser() {
  if (!await isConfiguredCellRuntimeActive()) return null;
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  const session = await verifySessionToken(token);

  if (!session) {
    return null;
  }

  const user = await db.user.findUnique({
    where: { id: session.id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      active: true
    }
  });

  if (!user?.active) {
    return null;
  }

  return user;
}

export async function requireUser(module?: CellModule) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (module) await requireCellModule(module);

  return user;
}
