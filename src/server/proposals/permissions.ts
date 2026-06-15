import { canViewCompanyRecords } from "@/server/auth/permissions";
import type { ProposalUser } from "./types";

export function assertCanViewProposals(user: ProposalUser) {
  if (!canViewCompanyRecords(user.role)) {
    throw new Error("You do not have permission to view proposals.");
  }
}

export function assertCanWriteProposals(user: ProposalUser) {
  if (!canViewCompanyRecords(user.role)) {
    throw new Error("You do not have permission to manage proposals.");
  }
}
