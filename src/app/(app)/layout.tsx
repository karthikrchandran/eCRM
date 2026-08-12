import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/server/auth/current-user";
import { getEnabledCellModules } from "@/server/cell-admin/module-access";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const enabledModules = await getEnabledCellModules();

  return <AppShell enabledModules={enabledModules} user={user}>{children}</AppShell>;
}
