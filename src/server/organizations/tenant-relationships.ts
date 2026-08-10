export type TenantOwnedRelationship = {
  child: string;
  childField: string;
  parent: string;
  parentField: "id";
};

export const tenantOwnedRelationships = [
  { child: "SharedBusinessRecordVersion", childField: "recordId", parent: "SharedBusinessRecord", parentField: "id" },
  { child: "SharedRecordExportSnapshotItem", childField: "snapshotId", parent: "SharedRecordExportSnapshot", parentField: "id" },
  { child: "Branch", childField: "leadCustomerId", parent: "LeadCustomer", parentField: "id" },
  { child: "Contact", childField: "leadCustomerId", parent: "LeadCustomer", parentField: "id" },
  { child: "Contact", childField: "branchId", parent: "Branch", parentField: "id" },
  { child: "Activity", childField: "leadCustomerId", parent: "LeadCustomer", parentField: "id" },
  { child: "Activity", childField: "branchId", parent: "Branch", parentField: "id" },
  { child: "Activity", childField: "contactId", parent: "Contact", parentField: "id" },
  { child: "SalesTask", childField: "leadCustomerId", parent: "LeadCustomer", parentField: "id" },
  { child: "SalesTask", childField: "opportunityId", parent: "Opportunity", parentField: "id" },
  { child: "SalesTask", childField: "proposalId", parent: "Proposal", parentField: "id" },
  { child: "SalesTask", childField: "orderId", parent: "Order", parentField: "id" },
  { child: "SalesTextNote", childField: "taskId", parent: "SalesTask", parentField: "id" },
  { child: "SalesTextNote", childField: "leadCustomerId", parent: "LeadCustomer", parentField: "id" },
  { child: "SalesTextNote", childField: "opportunityId", parent: "Opportunity", parentField: "id" },
  { child: "SalesTextNote", childField: "proposalId", parent: "Proposal", parentField: "id" },
  { child: "SalesTextNote", childField: "orderId", parent: "Order", parentField: "id" },
  { child: "SalesVoiceNote", childField: "taskId", parent: "SalesTask", parentField: "id" },
  { child: "SalesVoiceNote", childField: "leadCustomerId", parent: "LeadCustomer", parentField: "id" },
  { child: "SalesVoiceNote", childField: "opportunityId", parent: "Opportunity", parentField: "id" },
  { child: "SalesVoiceNote", childField: "proposalId", parent: "Proposal", parentField: "id" },
  { child: "SalesVoiceNote", childField: "orderId", parent: "Order", parentField: "id" },
  { child: "SalesVoiceNoteAction", childField: "voiceNoteId", parent: "SalesVoiceNote", parentField: "id" },
  { child: "SalesVoiceNoteAction", childField: "createdTaskId", parent: "SalesTask", parentField: "id" },
  { child: "SalesDayReviewItem", childField: "reviewId", parent: "SalesDayReview", parentField: "id" },
  { child: "SalesDayReviewItem", childField: "taskId", parent: "SalesTask", parentField: "id" },
  { child: "LeadOwnershipHistory", childField: "leadCustomerId", parent: "LeadCustomer", parentField: "id" },
  { child: "Opportunity", childField: "leadCustomerId", parent: "LeadCustomer", parentField: "id" },
  { child: "Opportunity", childField: "branchId", parent: "Branch", parentField: "id" },
  { child: "Opportunity", childField: "stageId", parent: "PipelineStage", parentField: "id" },
  { child: "OpportunityOwnerSplit", childField: "opportunityId", parent: "Opportunity", parentField: "id" },
  { child: "Proposal", childField: "opportunityId", parent: "Opportunity", parentField: "id" },
  { child: "ProposalLineItem", childField: "proposalId", parent: "Proposal", parentField: "id" },
  { child: "ProposalLineItem", childField: "productServiceId", parent: "ProductService", parentField: "id" },
  { child: "ProposalPdfAttachment", childField: "proposalId", parent: "Proposal", parentField: "id" },
  { child: "Order", childField: "proposalId", parent: "Proposal", parentField: "id" },
  { child: "Order", childField: "opportunityId", parent: "Opportunity", parentField: "id" },
  { child: "Order", childField: "leadCustomerId", parent: "LeadCustomer", parentField: "id" },
  { child: "Order", childField: "branchId", parent: "Branch", parentField: "id" },
  { child: "OrderLineItem", childField: "orderId", parent: "Order", parentField: "id" },
  { child: "OrderLineItem", childField: "proposalLineItemId", parent: "ProposalLineItem", parentField: "id" },
  { child: "OrderLineItem", childField: "productServiceId", parent: "ProductService", parentField: "id" },
  { child: "OrderOwnerSplitSnapshot", childField: "orderId", parent: "Order", parentField: "id" },
  { child: "ProductionTemplateStage", childField: "templateId", parent: "ProductionTemplate", parentField: "id" },
  { child: "ProductionWorkItem", childField: "orderLineItemId", parent: "OrderLineItem", parentField: "id" },
  { child: "ProductionWorkItem", childField: "productionTemplateId", parent: "ProductionTemplate", parentField: "id" },
  { child: "ProductionStageInstance", childField: "workItemId", parent: "ProductionWorkItem", parentField: "id" },
  { child: "ProductionStageInstance", childField: "templateStageId", parent: "ProductionTemplateStage", parentField: "id" },
  { child: "ProductionNote", childField: "workItemId", parent: "ProductionWorkItem", parentField: "id" },
  { child: "ProductionNote", childField: "stageInstanceId", parent: "ProductionStageInstance", parentField: "id" },
  { child: "Invoice", childField: "orderId", parent: "Order", parentField: "id" },
  { child: "Payment", childField: "orderId", parent: "Order", parentField: "id" },
  { child: "PaymentAllocation", childField: "paymentId", parent: "Payment", parentField: "id" },
  { child: "PaymentAllocation", childField: "invoiceId", parent: "Invoice", parentField: "id" },
  { child: "CostComponent", childField: "orderId", parent: "Order", parentField: "id" },
  { child: "CostComponent", childField: "orderLineItemId", parent: "OrderLineItem", parentField: "id" },
  { child: "Incentive", childField: "orderId", parent: "Order", parentField: "id" },
  { child: "IncentiveSplit", childField: "incentiveId", parent: "Incentive", parentField: "id" }
] as const satisfies readonly TenantOwnedRelationship[];

export const tenantOpaqueOwnedRelationships = [
  { child: "SharedBusinessRecord", childField: "parentId", parent: "SharedBusinessRecord", parentField: "id" }
] as const satisfies readonly TenantOwnedRelationship[];

export type TenantUserRelationship = {
  child: string;
  childField: string;
};

/**
 * Every User foreign key carried by an organization-owned model. Database
 * triggers generated from this inventory reject inactive, revoked, or
 * cross-organization users even when an application write copies a stale ID.
 */
export const tenantUserRelationships = [
  { child: "LeadCustomer", childField: "ownerId" },
  { child: "LeadCustomer", childField: "createdById" },
  { child: "LeadCustomer", childField: "updatedById" },
  { child: "Activity", childField: "ownerId" },
  { child: "Activity", childField: "createdById" },
  { child: "Activity", childField: "completedById" },
  { child: "SalesTask", childField: "ownerId" },
  { child: "SalesTextNote", childField: "ownerId" },
  { child: "SalesVoiceNote", childField: "ownerId" },
  { child: "SalesDayReview", childField: "ownerId" },
  { child: "LeadOwnershipHistory", childField: "fromOwnerId" },
  { child: "LeadOwnershipHistory", childField: "toOwnerId" },
  { child: "LeadOwnershipHistory", childField: "changedById" },
  { child: "Opportunity", childField: "ownerId" },
  { child: "Opportunity", childField: "createdById" },
  { child: "Opportunity", childField: "updatedById" },
  { child: "OpportunityOwnerSplit", childField: "userId" },
  { child: "SalesTarget", childField: "ownerId" },
  { child: "SalesTarget", childField: "createdById" },
  { child: "ProductService", childField: "createdById" },
  { child: "ProductService", childField: "updatedById" },
  { child: "Proposal", childField: "createdById" },
  { child: "Proposal", childField: "updatedById" },
  { child: "ProposalPdfAttachment", childField: "uploadedById" },
  { child: "Order", childField: "ownerId" },
  { child: "Order", childField: "createdById" },
  { child: "Order", childField: "updatedById" },
  { child: "OrderOwnerSplitSnapshot", childField: "userId" },
  { child: "ProductionWorkItem", childField: "assignedToId" },
  { child: "ProductionWorkItem", childField: "createdById" },
  { child: "ProductionWorkItem", childField: "updatedById" },
  { child: "ProductionStageInstance", childField: "assignedToId" },
  { child: "ProductionStageInstance", childField: "completedById" },
  { child: "ProductionNote", childField: "createdById" },
  { child: "Invoice", childField: "createdById" },
  { child: "Invoice", childField: "updatedById" },
  { child: "Invoice", childField: "voidedById" },
  { child: "Payment", childField: "createdById" },
  { child: "CostComponent", childField: "createdById" },
  { child: "CostComponent", childField: "updatedById" },
  { child: "CostComponent", childField: "approvedById" },
  { child: "CostComponent", childField: "rejectedById" },
  { child: "CostComponent", childField: "voidedById" },
  { child: "Incentive", childField: "approvedById" },
  { child: "Incentive", childField: "overrideById" },
  { child: "Incentive", childField: "rejectedById" },
  { child: "Incentive", childField: "paidById" },
  { child: "IncentiveSplit", childField: "userId" }
] as const satisfies readonly TenantUserRelationship[];
