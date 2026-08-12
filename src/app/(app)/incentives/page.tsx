import { redirect } from "next/navigation";
import type { IncentiveStatus } from "@prisma/client";
import { IncentiveList } from "@/components/incentives/incentive-list";
import { requireUser } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { listIncentives } from "@/server/finance/incentives-queries";

function parseOptionalNumber(value: string | string[] | undefined) {
  if (value === undefined) {
    return undefined;
  }

  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) {
    return undefined;
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

const incentiveStatuses = new Set<IncentiveStatus>(["NOT_READY", "READY_FOR_REVIEW", "APPROVED", "REJECTED", "PAID", "VOID"]);

export default async function IncentivesPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser("finance");
  if (user.role === "SALES") {
    redirect("/performance");
  }

  const rawSearchParams = await searchParams;
  const filters = {
    financialYear: parseOptionalNumber(rawSearchParams.financialYear),
    ownerId: Array.isArray(rawSearchParams.ownerId) ? rawSearchParams.ownerId[0] : rawSearchParams.ownerId || undefined,
    quarter: parseOptionalNumber(rawSearchParams.quarter) as 1 | 2 | 3 | 4 | undefined,
    status: (() => {
      const rawStatus = Array.isArray(rawSearchParams.status) ? rawSearchParams.status[0] : rawSearchParams.status;
      return rawStatus && incentiveStatuses.has(rawStatus as IncentiveStatus) ? (rawStatus as IncentiveStatus) : undefined;
    })()
  };

  const [incentives, owners] = await Promise.all([
    listIncentives(user, filters),
    db.user.findMany({
      where: { active: true, role: { in: ["ADMIN", "SALES"] } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true }
    })
  ]);

  return <IncentiveList filters={filters} incentives={incentives} owners={owners} title="Incentives" subtitle="Company-wide incentive status and payout tracking." />;
}
