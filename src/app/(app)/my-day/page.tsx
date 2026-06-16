import { MyDayPage } from "@/components/sales-day/my-day-page";
import { requireUser } from "@/server/auth/current-user";
import { loadMyDay, loadMyDayInsights, loadMyDayLookups } from "@/server/sales-day/queries";

function parseDate(value: string | string[] | undefined) {
  if (typeof value !== "string" || !value) {
    return new Date();
  }

  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function parseView(value: string | string[] | undefined): "today" | "insights" | "review" {
  if (value === "insights" || value === "review") {
    return value;
  }

  return "today";
}

export default async function MyDayRoute({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const rawSearchParams = await searchParams;
  const date = parseDate(rawSearchParams.date);
  const activeView = parseView(rawSearchParams.view);
  const [myDay, insights, lookups] = await Promise.all([
    loadMyDay(user, date),
    loadMyDayInsights(user, date),
    loadMyDayLookups(user)
  ]);

  return <MyDayPage activeView={activeView} insights={insights} lookups={lookups} myDay={myDay} />;
}
