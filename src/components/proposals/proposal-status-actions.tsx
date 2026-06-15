type ProposalStatusActionsProps = {
  action: (formData: FormData) => Promise<void>;
  status: string;
};

const transitions = ["SENT", "ACCEPTED", "REJECTED", "EXPIRED", "WITHDRAWN"];

export function ProposalStatusActions({ action, status }: ProposalStatusActionsProps) {
  if (["REJECTED", "EXPIRED", "WITHDRAWN"].includes(status)) {
    return null;
  }

  return (
    <form action={action} className="mt-4 flex flex-wrap gap-2">
      {transitions
        .filter((nextStatus) => nextStatus !== status)
        .map((nextStatus) => (
          <button className="crm-button crm-button-secondary text-sm" key={nextStatus} name="status" type="submit" value={nextStatus}>
            Mark {nextStatus.toLowerCase()}
          </button>
        ))}
    </form>
  );
}
