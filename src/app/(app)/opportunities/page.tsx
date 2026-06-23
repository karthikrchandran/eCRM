import { OpportunityBoard } from "@/components/opportunities/opportunity-board";
import { OpportunityList } from "@/components/opportunities/opportunity-list";
import { requireUser } from "@/server/auth/current-user";
import { listOpportunityFormOptions, listOpportunities, listPipelineBoard } from "@/server/opportunities/queries";
import { opportunityFilterSchema } from "@/server/opportunities/validators";

export default async function OpportunitiesPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const rawSearchParams = await searchParams;
  const filters = opportunityFilterSchema.parse({
    q: rawSearchParams.q,
    ownerId: rawSearchParams.ownerId,
    stageId: rawSearchParams.stageId,
    followUp: rawSearchParams.followUp,
    view: rawSearchParams.view
  });
  const optionsPromise = listOpportunityFormOptions();

  if (filters.view === "board") {
    const [options, board, records] = await Promise.all([optionsPromise, listPipelineBoard(user, filters), listOpportunities(user, filters)]);

    return (
      <OpportunityList filters={filters} owners={options.owners} records={records} stages={options.stages}>
        <OpportunityBoard recordsByStage={board.recordsByStage} stages={board.stages} />
      </OpportunityList>
    );
  }

  const [options, records] = await Promise.all([optionsPromise, listOpportunities(user, filters)]);

  return <OpportunityList filters={filters} owners={options.owners} records={records} stages={options.stages} />;
}
