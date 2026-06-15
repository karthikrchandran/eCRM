import { canViewCompanyRecords } from "@/server/auth/permissions";

export type OpportunityUser = {
  id: string;
  role: "ADMIN" | "SALES";
};

export function assertCanViewOpportunities(user: OpportunityUser) {
  if (!canViewCompanyRecords(user.role)) {
    throw new Error("You do not have permission to view opportunities.");
  }
}

export function assertCanWriteOpportunities(user: OpportunityUser) {
  if (!canViewCompanyRecords(user.role)) {
    throw new Error("You do not have permission to manage opportunities.");
  }
}
