import {
  completeActivity,
  createActivity,
  createBranch,
  createContact,
  createLeadCustomer,
  reassignLeadOwner,
  updateLeadCustomer
} from "@/server/crm/mutations";
import {
  getContactDetail,
  getCustomer360Timeline,
  getDashboardFollowUpCounts,
  getLeadCustomerDetail,
  listBranchOptions,
  listContacts,
  listLeadCustomers
} from "@/server/crm/queries";
import {
  approveIncentive,
  changeCostComponentStatus,
  createCostComponent,
  createInvoice,
  markIncentivePaid,
  recordPayment,
  rejectIncentive,
  updateIncentiveSplits,
  updateInvoice
} from "@/server/finance/mutations";
import { getOrderFinanceSummary } from "@/server/finance/queries";
import {
  createOpportunity,
  moveOpportunityStage,
  updateOpportunity,
  upsertPipelineStage,
  upsertSalesTarget
} from "@/server/opportunities/mutations";
import {
  getOpportunityDetail,
  listOpportunities,
  listPipelineBoard,
  listSalesTargets
} from "@/server/opportunities/queries";
import { changeOrderStatus, createOrderFromAcceptedProposal, updateOrderPoMetadata } from "@/server/orders/mutations";
import { getOrderDetail, listOrders } from "@/server/orders/queries";
import { createProductService, setProductServiceActive, updateProductService } from "@/server/products/mutations";
import { getProductServiceForAdmin, listActiveProductServices, listProductServicesForAdmin } from "@/server/products/queries";
import { addProposalPdfMetadata, changeProposalStatus, createProposal } from "@/server/proposals/mutations";
import { getProposalDetail, listProposalsForOpportunity } from "@/server/proposals/queries";
import {
  instantiateProductionForOrderLineItem,
  saveProductionTemplate,
  saveProductionTemplateStage,
  updateProductionStageStatus
} from "@/server/production/mutations";
import {
  getProductionWorkItemDetail,
  listProductionBoard,
  listProductionTemplateConfig,
  listProductionWorkItems
} from "@/server/production/queries";
import { getReportsOverview } from "@/server/reports/queries";
import { listRepPerformanceSummaries } from "@/server/reports/rep-performance-queries";
import {
  acceptSuggestedAction,
  cancelSalesTask,
  completeSalesTask,
  createSalesTask,
  createSalesTextNote,
  createSalesVoiceNote,
  createSuggestedActionsForVoiceNote,
  deleteSalesTextNote,
  markVoiceNoteFailed,
  markVoiceNoteTranscribing,
  rejectSuggestedAction,
  saveEndOfDayReview,
  saveVoiceNoteTranscript,
  updateSalesTask,
  updateSalesTextNote
} from "@/server/sales-day/mutations";
import { loadMyDay, loadMyDayInsights } from "@/server/sales-day/queries";
import { buildSharedRecordExportPage } from "@/server/shared-records/export";
import { upsertSharedRecord } from "@/server/shared-records/mutations";
import { getSharedRecord, listSharedRecords } from "@/server/shared-records/queries";
import { ingestWorkflowEvent, listWorkflowEventsForEntity } from "@/server/workflow-events/service";

import { tenantIsolationCategories, type TenantIsolationCategory } from "./tenant-adversarial-matrix";

type PublicOperation = (...args: never[]) => unknown;

type ExecutableDraft = {
  disposition: "executable";
  operation: PublicOperation;
};

type ReviewedNaDraft = {
  disposition: "reviewed-na";
  equivalentCategory: TenantIsolationCategory;
  operation: PublicOperation;
  reason: string;
};

type ScenarioDraft = ExecutableDraft | ReviewedNaDraft;

export type TenantPublicOperationScenario = {
  category: TenantIsolationCategory;
  disposition: ScenarioDraft["disposition"];
  equivalentCategory?: TenantIsolationCategory;
  exportName: string;
  expectedOutcome: TenantPublicOperationOutcome;
  model: string;
  operation: PublicOperation;
  reason?: string;
  run(context: TenantPublicOperationContext): Promise<TenantPublicOperationExecution>;
};

export type TenantPublicOperationOutcome = "success" | "denied" | "duplicate" | "na-equivalent";

export type TenantPublicOperationExecution = {
  category: TenantIsolationCategory;
  exportName: string;
  model: string;
  outcome: TenantPublicOperationOutcome;
};

type TenantPublicOperationHandler<C extends TenantIsolationCategory> = {
  category: C;
  run(scenario: TenantPublicOperationScenario): Promise<TenantPublicOperationOutcome>;
};
export type TenantPublicOperationContext = {
  [Category in TenantIsolationCategory]: TenantPublicOperationHandler<Category>;
};

type ModelDraft = Record<TenantIsolationCategory, ScenarioDraft>;
export type TenantPublicOperationModelMatrix = Record<TenantIsolationCategory, TenantPublicOperationScenario>;

type EquivalentScenario = {
  disposition: "executable" | "reviewed-na";
  equivalentCategory?: string;
};

export function resolveTenantPublicEquivalent(
  matrix: Record<string, Record<string, EquivalentScenario>>,
  model: string,
  category: string
): { category: string; scenario: EquivalentScenario } {
  const visited = new Set<string>();
  let currentCategory = category;
  while (true) {
    const key = `${model}:${currentCategory}`;
    if (visited.has(key)) throw new Error(`Cyclic tenant-isolation N/A equivalent: ${[...visited, key].join(" -> ")}`);
    visited.add(key);
    const scenario = matrix[model]?.[currentCategory];
    if (!scenario) throw new Error(`Missing tenant-isolation N/A equivalent endpoint: ${key}`);
    if (scenario.disposition === "executable") return { category: currentCategory, scenario };
    if (!scenario.equivalentCategory) throw new Error(`N/A tenant-isolation scenario has no executable endpoint: ${key}`);
    currentCategory = scenario.equivalentCategory;
  }
}

const executable = (operation: PublicOperation): ExecutableDraft => ({ disposition: "executable", operation });
const reviewedNa = (
  operation: PublicOperation,
  equivalentCategory: TenantIsolationCategory,
  reason: string
): ReviewedNaDraft => ({ disposition: "reviewed-na", equivalentCategory, operation, reason });

function defineModel(model: string, draft: ModelDraft): TenantPublicOperationModelMatrix {
  return Object.fromEntries(tenantIsolationCategories.map((category) => {
    const cell = draft[category];
    const scenario: TenantPublicOperationScenario = {
      ...cell,
      category,
      exportName: cell.operation.name,
      expectedOutcome: cell.disposition === "reviewed-na"
        ? "na-equivalent"
        : category === "direct-id" || category === "foreign-attachment"
          ? "denied"
          : category === "duplicate-identifier"
            ? "duplicate"
            : "success",
      model,
      async run(context) {
        if (scenario.disposition === "reviewed-na") {
          const resolved = resolveTenantPublicEquivalent(
            tenantPublicOperationMatrix as unknown as Record<string, Record<string, EquivalentScenario>>,
            model,
            category
          );
          const executable = resolved.scenario as TenantPublicOperationScenario;
          const executableCategory = resolved.category as TenantIsolationCategory;
          const handler = context[executableCategory];
          if (!handler) throw new Error(`Missing ${executableCategory} tenant-isolation handler for ${model}.`);
          if (handler.category !== executableCategory) {
            throw new Error(`${executableCategory[0]!.toUpperCase()}${executableCategory.slice(1)} handler is bound to ${handler.category}.`);
          }
          const outcome = await handler.run(executable);
          if (outcome !== executable.expectedOutcome) {
            throw new Error(`${model}:${executableCategory} expected ${executable.expectedOutcome} but observed ${outcome}.`);
          }
          return { category, exportName: executable.exportName, model, outcome: "na-equivalent" };
        }

        const handler = context[category];
        if (!handler) throw new Error(`Missing ${category} tenant-isolation handler for ${model}.`);
        if (handler.category !== category) {
          throw new Error(`${category[0]!.toUpperCase()}${category.slice(1)} handler is bound to ${handler.category}.`);
        }
        const outcome = await handler.run(scenario);
        if (outcome !== scenario.expectedOutcome) {
          throw new Error(`${model}:${category} expected ${scenario.expectedOutcome} but observed ${outcome}.`);
        }
        return { category, exportName: scenario.exportName, model, outcome };
      }
    };
    return [category, scenario];
  })) as TenantPublicOperationModelMatrix;
}

const noStandaloneDelete = (operation: PublicOperation, equivalentCategory: TenantIsolationCategory = "direct-id") =>
  reviewedNa(operation, equivalentCategory, "The public lifecycle does not physically delete this model; the named read or status operation is the executable equivalent.");
const noBusinessIdentifier = (operation: PublicOperation, equivalentCategory: TenantIsolationCategory = "direct-id") =>
  reviewedNa(operation, equivalentCategory, "This model has no organization-scoped business identifier; the named tenant-scoped operation is the executable equivalent.");
const parentManaged = (operation: PublicOperation, equivalentCategory: TenantIsolationCategory, detail: string) =>
  reviewedNa(operation, equivalentCategory, `${detail}; the named parent public operation executes the equivalent isolation boundary.`);

export const tenantPublicOperationMatrix = {
  SharedBusinessRecord: defineModel("SharedBusinessRecord", {
    list: executable(listSharedRecords), "direct-id": executable(getSharedRecord), search: executable(listSharedRecords),
    aggregate: executable(buildSharedRecordExportPage), create: executable(upsertSharedRecord), update: executable(upsertSharedRecord),
    delete: noStandaloneDelete(getSharedRecord), "foreign-attachment": executable(upsertSharedRecord),
    "nested-include": executable(getSharedRecord), "duplicate-identifier": executable(upsertSharedRecord)
  }),
  SharedBusinessRecordVersion: defineModel("SharedBusinessRecordVersion", {
    list: parentManaged(getSharedRecord, "nested-include", "Versions are immutable children returned with a shared record"),
    "direct-id": parentManaged(getSharedRecord, "nested-include", "Versions have no standalone public detail endpoint"),
    search: parentManaged(getSharedRecord, "nested-include", "Versions are searched through their current shared record"),
    aggregate: parentManaged(getSharedRecord, "nested-include", "Version rows are not independently aggregated"),
    create: parentManaged(getSharedRecord, "nested-include", "Versions are created atomically by shared-record upsert"),
    update: parentManaged(getSharedRecord, "nested-include", "Versions are append-only and produced by shared-record update"),
    delete: parentManaged(getSharedRecord, "nested-include", "Versions are immutable audit rows"),
    "foreign-attachment": executable(upsertSharedRecord), "nested-include": executable(getSharedRecord),
    "duplicate-identifier": parentManaged(getSharedRecord, "nested-include", "Version numbers are scoped to their parent shared record")
  }),
  SharedRecordExportSnapshot: defineModel("SharedRecordExportSnapshot", {
    list: parentManaged(listSharedRecords, "aggregate", "Export snapshots are internal resumable export state"),
    "direct-id": parentManaged(buildSharedRecordExportPage, "aggregate", "Snapshots are addressed by signed cursor and have no standalone public detail operation"), search: parentManaged(buildSharedRecordExportPage, "aggregate", "Snapshots are addressed by signed cursor, not search"),
    aggregate: executable(buildSharedRecordExportPage), create: executable(buildSharedRecordExportPage), update: parentManaged(buildSharedRecordExportPage, "aggregate", "Snapshot lifecycle updates are internal to export materialization"),
    delete: parentManaged(buildSharedRecordExportPage, "aggregate", "Expired snapshots are internal lifecycle state"),
    "foreign-attachment": parentManaged(buildSharedRecordExportPage, "nested-include", "Snapshot ownership is derived from the export transaction"),
    "nested-include": executable(buildSharedRecordExportPage), "duplicate-identifier": noBusinessIdentifier(buildSharedRecordExportPage, "aggregate")
  }),
  SharedRecordExportSnapshotItem: defineModel("SharedRecordExportSnapshotItem", {
    list: executable(buildSharedRecordExportPage), "direct-id": parentManaged(buildSharedRecordExportPage, "nested-include", "Snapshot items have no standalone public detail endpoint"),
    search: parentManaged(listSharedRecords, "aggregate", "Snapshot items inherit the export filters"), aggregate: executable(buildSharedRecordExportPage),
    create: executable(buildSharedRecordExportPage), update: parentManaged(buildSharedRecordExportPage, "aggregate", "Snapshot items are immutable after materialization"),
    delete: parentManaged(buildSharedRecordExportPage, "aggregate", "Snapshot items expire with their parent snapshot"),
    "foreign-attachment": parentManaged(buildSharedRecordExportPage, "nested-include", "Snapshot item ownership is derived from the snapshot materialization transaction"), "nested-include": executable(buildSharedRecordExportPage),
    "duplicate-identifier": noBusinessIdentifier(buildSharedRecordExportPage, "nested-include")
  }),
  WorkflowEvent: defineModel("WorkflowEvent", {
    list: executable(listWorkflowEventsForEntity), "direct-id": executable(listWorkflowEventsForEntity), search: executable(listWorkflowEventsForEntity),
    aggregate: executable(listWorkflowEventsForEntity), create: executable(ingestWorkflowEvent),
    update: parentManaged(listWorkflowEventsForEntity, "direct-id", "Workflow events are append-only"),
    delete: parentManaged(listWorkflowEventsForEntity, "list", "Workflow events are append-only"),
    "foreign-attachment": executable(ingestWorkflowEvent),
    "nested-include": parentManaged(listWorkflowEventsForEntity, "list", "Workflow events expose no nested child collection"),
    "duplicate-identifier": executable(ingestWorkflowEvent)
  }),
  LeadCustomer: defineModel("LeadCustomer", {
    list: executable(listLeadCustomers), "direct-id": executable(getLeadCustomerDetail), search: executable(listLeadCustomers),
    aggregate: executable(getDashboardFollowUpCounts), create: executable(createLeadCustomer), update: executable(updateLeadCustomer),
    delete: noStandaloneDelete(getLeadCustomerDetail), "foreign-attachment": executable(createBranch),
    "nested-include": executable(getLeadCustomerDetail), "duplicate-identifier": noBusinessIdentifier(listLeadCustomers, "search")
  }),
  Branch: defineModel("Branch", {
    list: executable(listBranchOptions), "direct-id": executable(getLeadCustomerDetail), search: executable(listLeadCustomers),
    aggregate: executable(getLeadCustomerDetail), create: executable(createBranch),
    update: parentManaged(getLeadCustomerDetail, "direct-id", "Branches have no standalone public update operation"),
    delete: noStandaloneDelete(getLeadCustomerDetail), "foreign-attachment": executable(createBranch),
    "nested-include": executable(getLeadCustomerDetail), "duplicate-identifier": noBusinessIdentifier(listBranchOptions, "list")
  }),
  Contact: defineModel("Contact", {
    list: executable(listContacts), "direct-id": executable(getContactDetail), search: executable(listContacts),
    aggregate: executable(getLeadCustomerDetail), create: executable(createContact),
    update: parentManaged(getContactDetail, "direct-id", "Contact updates use the same scoped contact detail target"),
    delete: noStandaloneDelete(getContactDetail), "foreign-attachment": executable(createContact),
    "nested-include": executable(getContactDetail), "duplicate-identifier": noBusinessIdentifier(listContacts, "search")
  }),
  Activity: defineModel("Activity", {
    list: executable(getCustomer360Timeline), "direct-id": executable(completeActivity), search: executable(listLeadCustomers),
    aggregate: executable(getDashboardFollowUpCounts), create: executable(createActivity), update: executable(completeActivity),
    delete: noStandaloneDelete(getCustomer360Timeline, "list"), "foreign-attachment": executable(createActivity),
    "nested-include": executable(getLeadCustomerDetail), "duplicate-identifier": noBusinessIdentifier(getCustomer360Timeline, "list")
  }),
  LeadOwnershipHistory: defineModel("LeadOwnershipHistory", {
    list: executable(getLeadCustomerDetail), "direct-id": parentManaged(getLeadCustomerDetail, "nested-include", "Ownership history is an immutable nested audit record"),
    search: parentManaged(getLeadCustomerDetail, "nested-include", "Ownership history is discovered through the lead search"), aggregate: executable(getLeadCustomerDetail),
    create: executable(reassignLeadOwner), update: parentManaged(reassignLeadOwner, "create", "Ownership history rows are append-only"),
    delete: parentManaged(getLeadCustomerDetail, "nested-include", "Ownership history rows are immutable"),
    "foreign-attachment": executable(reassignLeadOwner), "nested-include": executable(getLeadCustomerDetail),
    "duplicate-identifier": noBusinessIdentifier(getLeadCustomerDetail, "nested-include")
  }),
  SalesTask: defineModel("SalesTask", {
    list: executable(loadMyDay), "direct-id": executable(completeSalesTask), search: executable(loadMyDay), aggregate: executable(loadMyDayInsights),
    create: executable(createSalesTask), update: executable(updateSalesTask), delete: noStandaloneDelete(cancelSalesTask, "update"),
    "foreign-attachment": executable(createSalesTask), "nested-include": executable(loadMyDay), "duplicate-identifier": noBusinessIdentifier(loadMyDay, "list")
  }),
  SalesTextNote: defineModel("SalesTextNote", {
    list: executable(loadMyDay), "direct-id": executable(updateSalesTextNote), search: parentManaged(loadMyDay, "list", "Text notes have no standalone search endpoint"),
    aggregate: parentManaged(loadMyDay, "list", "Text notes are represented through My Day insights"),
    create: executable(createSalesTextNote), update: executable(updateSalesTextNote), delete: executable(deleteSalesTextNote),
    "foreign-attachment": executable(createSalesTextNote), "nested-include": executable(loadMyDay), "duplicate-identifier": noBusinessIdentifier(loadMyDay, "list")
  }),
  SalesVoiceNote: defineModel("SalesVoiceNote", {
    list: executable(loadMyDay), "direct-id": executable(markVoiceNoteTranscribing), search: parentManaged(loadMyDay, "list", "Voice notes have no standalone search endpoint"),
    aggregate: executable(loadMyDayInsights), create: executable(createSalesVoiceNote), update: executable(saveVoiceNoteTranscript),
    delete: noStandaloneDelete(markVoiceNoteFailed, "update"), "foreign-attachment": executable(createSalesVoiceNote),
    "nested-include": executable(loadMyDay), "duplicate-identifier": noBusinessIdentifier(loadMyDay, "list")
  }),
  SalesVoiceNoteAction: defineModel("SalesVoiceNoteAction", {
    list: executable(loadMyDay), "direct-id": executable(acceptSuggestedAction), search: parentManaged(loadMyDay, "nested-include", "Suggested actions are nested under voice notes"),
    aggregate: parentManaged(loadMyDay, "nested-include", "Suggested actions have no standalone aggregate"),
    create: executable(createSuggestedActionsForVoiceNote), update: executable(rejectSuggestedAction), delete: noStandaloneDelete(rejectSuggestedAction, "update"),
    "foreign-attachment": executable(acceptSuggestedAction), "nested-include": executable(loadMyDay), "duplicate-identifier": noBusinessIdentifier(loadMyDay, "nested-include")
  }),
  SalesDayReview: defineModel("SalesDayReview", {
    list: parentManaged(loadMyDayInsights, "aggregate", "End-of-day reviews are managed through My Day"), "direct-id": parentManaged(loadMyDayInsights, "aggregate", "Reviews have no caller-selected identifier; the scoped My Day aggregate is the executable equivalent"),
    search: parentManaged(loadMyDayInsights, "aggregate", "Reviews have no standalone search endpoint"), aggregate: executable(loadMyDayInsights),
    create: executable(saveEndOfDayReview), update: executable(saveEndOfDayReview), delete: noStandaloneDelete(loadMyDayInsights, "aggregate"),
    "foreign-attachment": executable(saveEndOfDayReview), "nested-include": executable(saveEndOfDayReview), "duplicate-identifier": executable(saveEndOfDayReview)
  }),
  SalesDayReviewItem: defineModel("SalesDayReviewItem", {
    list: parentManaged(saveEndOfDayReview, "nested-include", "Review items are nested under the saved review"),
    "direct-id": parentManaged(saveEndOfDayReview, "nested-include", "Review items have no standalone detail endpoint"),
    search: parentManaged(saveEndOfDayReview, "nested-include", "Review items are discovered through My Day"), aggregate: executable(loadMyDayInsights),
    create: executable(saveEndOfDayReview), update: executable(saveEndOfDayReview), delete: parentManaged(saveEndOfDayReview, "update", "Review items are replaced by the review save operation"),
    "foreign-attachment": executable(saveEndOfDayReview), "nested-include": executable(saveEndOfDayReview), "duplicate-identifier": executable(saveEndOfDayReview)
  }),
  PipelineStage: defineModel("PipelineStage", {
    list: executable(listPipelineBoard), "direct-id": executable(moveOpportunityStage), search: executable(listPipelineBoard), aggregate: executable(listPipelineBoard),
    create: executable(upsertPipelineStage), update: executable(upsertPipelineStage), delete: noStandaloneDelete(listPipelineBoard, "list"),
    "foreign-attachment": executable(moveOpportunityStage), "nested-include": executable(listPipelineBoard), "duplicate-identifier": executable(upsertPipelineStage)
  }),
  Opportunity: defineModel("Opportunity", {
    list: executable(listOpportunities), "direct-id": executable(getOpportunityDetail), search: executable(listOpportunities), aggregate: executable(listPipelineBoard),
    create: executable(createOpportunity), update: executable(updateOpportunity), delete: noStandaloneDelete(getOpportunityDetail),
    "foreign-attachment": executable(createOpportunity), "nested-include": executable(getOpportunityDetail), "duplicate-identifier": noBusinessIdentifier(listOpportunities, "search")
  }),
  OpportunityOwnerSplit: defineModel("OpportunityOwnerSplit", {
    list: executable(getOpportunityDetail), "direct-id": parentManaged(getOpportunityDetail, "nested-include", "Owner splits are nested under opportunity detail"),
    search: parentManaged(getOpportunityDetail, "nested-include", "Owner splits are found through opportunity search"), aggregate: executable(listRepPerformanceSummaries),
    create: executable(createOpportunity), update: executable(updateOpportunity), delete: executable(updateOpportunity),
    "foreign-attachment": executable(updateOpportunity), "nested-include": executable(getOpportunityDetail), "duplicate-identifier": noBusinessIdentifier(getOpportunityDetail, "nested-include")
  }),
  SalesTarget: defineModel("SalesTarget", {
    list: executable(listSalesTargets), "direct-id": executable(upsertSalesTarget), search: parentManaged(listSalesTargets, "list", "Sales targets use structured fiscal filters rather than text search"),
    aggregate: executable(listRepPerformanceSummaries), create: executable(upsertSalesTarget), update: executable(upsertSalesTarget), delete: noStandaloneDelete(listSalesTargets, "list"),
    "foreign-attachment": executable(upsertSalesTarget), "nested-include": executable(listSalesTargets), "duplicate-identifier": executable(upsertSalesTarget)
  }),
  ProductService: defineModel("ProductService", {
    list: executable(listActiveProductServices), "direct-id": executable(getProductServiceForAdmin), search: executable(listProductServicesForAdmin),
    aggregate: executable(listProductServicesForAdmin), create: executable(createProductService), update: executable(updateProductService), delete: noStandaloneDelete(setProductServiceActive, "update"),
    "foreign-attachment": executable(createProposal), "nested-include": executable(getProposalDetail), "duplicate-identifier": executable(createProductService)
  }),
  Proposal: defineModel("Proposal", {
    list: executable(listProposalsForOpportunity), "direct-id": executable(getProposalDetail), search: executable(listProposalsForOpportunity), aggregate: executable(getReportsOverview),
    create: executable(createProposal), update: executable(changeProposalStatus), delete: noStandaloneDelete(getProposalDetail),
    "foreign-attachment": executable(createProposal), "nested-include": executable(getProposalDetail), "duplicate-identifier": executable(createProposal)
  }),
  ProposalLineItem: defineModel("ProposalLineItem", {
    list: executable(getProposalDetail), "direct-id": parentManaged(getProposalDetail, "nested-include", "Proposal lines are nested under proposal detail"),
    search: parentManaged(listProposalsForOpportunity, "list", "Proposal lines have no standalone search endpoint"), aggregate: executable(getReportsOverview),
    create: executable(createProposal), update: parentManaged(createProposal, "create", "Proposal lines are immutable snapshots created with a proposal"),
    delete: parentManaged(getProposalDetail, "nested-include", "Proposal lines have no standalone delete operation"),
    "foreign-attachment": executable(createProposal), "nested-include": executable(getProposalDetail), "duplicate-identifier": noBusinessIdentifier(getProposalDetail, "nested-include")
  }),
  ProposalPdfAttachment: defineModel("ProposalPdfAttachment", {
    list: executable(getProposalDetail), "direct-id": parentManaged(getProposalDetail, "nested-include", "PDF metadata is nested under proposal detail"),
    search: parentManaged(listProposalsForOpportunity, "list", "PDF metadata has no standalone search endpoint"), aggregate: parentManaged(getProposalDetail, "nested-include", "PDF metadata is not independently aggregated"),
    create: executable(addProposalPdfMetadata), update: parentManaged(addProposalPdfMetadata, "create", "PDF replacement appends metadata through the same public operation"),
    delete: parentManaged(getProposalDetail, "nested-include", "PDF metadata is retained for audit"),
    "foreign-attachment": executable(addProposalPdfMetadata), "nested-include": executable(getProposalDetail), "duplicate-identifier": noBusinessIdentifier(getProposalDetail, "nested-include")
  }),
  Order: defineModel("Order", {
    list: executable(listOrders), "direct-id": executable(getOrderDetail), search: executable(listOrders), aggregate: executable(getReportsOverview),
    create: executable(createOrderFromAcceptedProposal), update: executable(updateOrderPoMetadata), delete: noStandaloneDelete(changeOrderStatus, "update"),
    "foreign-attachment": executable(createOrderFromAcceptedProposal), "nested-include": executable(getOrderDetail), "duplicate-identifier": executable(createOrderFromAcceptedProposal)
  }),
  OrderLineItem: defineModel("OrderLineItem", {
    list: executable(getOrderDetail), "direct-id": parentManaged(getOrderDetail, "nested-include", "Order lines are nested under order detail"),
    search: parentManaged(listOrders, "list", "Order lines use their parent order filters"), aggregate: executable(getReportsOverview),
    create: executable(createOrderFromAcceptedProposal), update: parentManaged(getOrderDetail, "nested-include", "Order line snapshots are immutable after booking"),
    delete: parentManaged(getOrderDetail, "nested-include", "Order line snapshots are retained with the order"),
    "foreign-attachment": executable(instantiateProductionForOrderLineItem), "nested-include": executable(getOrderDetail), "duplicate-identifier": noBusinessIdentifier(getOrderDetail, "nested-include")
  }),
  OrderOwnerSplitSnapshot: defineModel("OrderOwnerSplitSnapshot", {
    list: executable(getOrderDetail), "direct-id": parentManaged(getOrderDetail, "nested-include", "Owner split snapshots are nested under order detail"),
    search: parentManaged(listOrders, "list", "Owner split snapshots use their parent order filters"), aggregate: executable(listRepPerformanceSummaries),
    create: executable(createOrderFromAcceptedProposal), update: parentManaged(getOrderDetail, "nested-include", "Owner split snapshots are immutable after booking"),
    delete: parentManaged(getOrderDetail, "nested-include", "Owner split snapshots are retained for attribution"),
    "foreign-attachment": executable(createOrderFromAcceptedProposal), "nested-include": executable(getOrderDetail), "duplicate-identifier": noBusinessIdentifier(getOrderDetail, "nested-include")
  }),
  ProductionTemplate: defineModel("ProductionTemplate", {
    list: executable(listProductionTemplateConfig), "direct-id": executable(saveProductionTemplate), search: executable(listProductionTemplateConfig), aggregate: executable(listProductionTemplateConfig),
    create: executable(saveProductionTemplate), update: executable(saveProductionTemplate), delete: noStandaloneDelete(saveProductionTemplate, "update"),
    "foreign-attachment": executable(instantiateProductionForOrderLineItem), "nested-include": executable(listProductionTemplateConfig), "duplicate-identifier": executable(saveProductionTemplate)
  }),
  ProductionTemplateStage: defineModel("ProductionTemplateStage", {
    list: executable(listProductionTemplateConfig), "direct-id": parentManaged(listProductionTemplateConfig, "nested-include", "Template stages are nested in template configuration"),
    search: parentManaged(listProductionTemplateConfig, "list", "Template stages use the template configuration list"), aggregate: executable(listProductionTemplateConfig),
    create: executable(saveProductionTemplateStage), update: executable(saveProductionTemplateStage), delete: noStandaloneDelete(listProductionTemplateConfig, "nested-include"),
    "foreign-attachment": executable(saveProductionTemplateStage), "nested-include": executable(listProductionTemplateConfig), "duplicate-identifier": executable(saveProductionTemplateStage)
  }),
  ProductionWorkItem: defineModel("ProductionWorkItem", {
    list: executable(listProductionWorkItems), "direct-id": executable(getProductionWorkItemDetail), search: executable(listProductionWorkItems), aggregate: executable(listProductionBoard),
    create: executable(instantiateProductionForOrderLineItem), update: executable(updateProductionStageStatus), delete: noStandaloneDelete(getProductionWorkItemDetail),
    "foreign-attachment": executable(instantiateProductionForOrderLineItem), "nested-include": executable(getProductionWorkItemDetail), "duplicate-identifier": noBusinessIdentifier(getProductionWorkItemDetail)
  }),
  ProductionStageInstance: defineModel("ProductionStageInstance", {
    list: executable(getProductionWorkItemDetail), "direct-id": executable(updateProductionStageStatus), search: parentManaged(getProductionWorkItemDetail, "nested-include", "Stage instances use the production work-item search"),
    aggregate: executable(listProductionBoard), create: executable(instantiateProductionForOrderLineItem), update: executable(updateProductionStageStatus),
    delete: noStandaloneDelete(getProductionWorkItemDetail, "nested-include"), "foreign-attachment": executable(updateProductionStageStatus),
    "nested-include": executable(getProductionWorkItemDetail), "duplicate-identifier": noBusinessIdentifier(getProductionWorkItemDetail, "nested-include")
  }),
  ProductionNote: defineModel("ProductionNote", {
    list: executable(getProductionWorkItemDetail), "direct-id": parentManaged(getProductionWorkItemDetail, "nested-include", "Production notes are nested under work-item detail"),
    search: parentManaged(getProductionWorkItemDetail, "nested-include", "Production notes use the production work-item search"), aggregate: parentManaged(getProductionWorkItemDetail, "nested-include", "Production notes have no standalone aggregate"),
    create: executable(updateProductionStageStatus), update: parentManaged(updateProductionStageStatus, "create", "Production notes are append-only stage updates"),
    delete: parentManaged(getProductionWorkItemDetail, "nested-include", "Production notes are retained for audit"),
    "foreign-attachment": executable(updateProductionStageStatus), "nested-include": executable(getProductionWorkItemDetail), "duplicate-identifier": noBusinessIdentifier(getProductionWorkItemDetail, "nested-include")
  }),
  Invoice: defineModel("Invoice", {
    list: executable(getOrderFinanceSummary), "direct-id": executable(updateInvoice), search: parentManaged(getOrderFinanceSummary, "list", "Invoices use their parent order finance filters"),
    aggregate: executable(getReportsOverview), create: executable(createInvoice), update: executable(updateInvoice), delete: noStandaloneDelete(getOrderFinanceSummary, "list"),
    "foreign-attachment": executable(createInvoice), "nested-include": executable(getOrderFinanceSummary), "duplicate-identifier": executable(createInvoice)
  }),
  Payment: defineModel("Payment", {
    list: executable(getOrderFinanceSummary), "direct-id": parentManaged(getOrderFinanceSummary, "nested-include", "Payments are nested under order finance detail"),
    search: parentManaged(getOrderFinanceSummary, "list", "Payments use their parent order finance filters"), aggregate: executable(getReportsOverview),
    create: executable(recordPayment), update: parentManaged(getOrderFinanceSummary, "nested-include", "Payments are immutable accounting records"),
    delete: parentManaged(getOrderFinanceSummary, "nested-include", "Payments are immutable accounting records"),
    "foreign-attachment": executable(recordPayment), "nested-include": executable(getOrderFinanceSummary), "duplicate-identifier": noBusinessIdentifier(getOrderFinanceSummary, "nested-include")
  }),
  PaymentAllocation: defineModel("PaymentAllocation", {
    list: executable(getOrderFinanceSummary), "direct-id": parentManaged(getOrderFinanceSummary, "nested-include", "Allocations are nested under payment and invoice detail"),
    search: parentManaged(getOrderFinanceSummary, "list", "Allocations use their parent order finance filters"), aggregate: executable(getReportsOverview),
    create: executable(recordPayment), update: parentManaged(getOrderFinanceSummary, "nested-include", "Allocations are immutable accounting records"),
    delete: parentManaged(getOrderFinanceSummary, "nested-include", "Allocations are immutable accounting records"),
    "foreign-attachment": executable(recordPayment), "nested-include": executable(getOrderFinanceSummary), "duplicate-identifier": noBusinessIdentifier(getOrderFinanceSummary, "nested-include")
  }),
  CostComponent: defineModel("CostComponent", {
    list: executable(getOrderFinanceSummary), "direct-id": executable(changeCostComponentStatus), search: parentManaged(getOrderFinanceSummary, "list", "Costs use their parent order finance filters"),
    aggregate: executable(getReportsOverview), create: executable(createCostComponent), update: executable(changeCostComponentStatus), delete: noStandaloneDelete(changeCostComponentStatus, "update"),
    "foreign-attachment": executable(createCostComponent), "nested-include": executable(getOrderFinanceSummary), "duplicate-identifier": noBusinessIdentifier(getOrderFinanceSummary, "nested-include")
  }),
  Incentive: defineModel("Incentive", {
    list: executable(getOrderFinanceSummary), "direct-id": executable(approveIncentive), search: executable(listRepPerformanceSummaries), aggregate: executable(listRepPerformanceSummaries),
    create: parentManaged(getOrderFinanceSummary, "nested-include", "Incentives are calculated by finance payment and cost operations"), update: executable(rejectIncentive),
    delete: noStandaloneDelete(markIncentivePaid, "update"), "foreign-attachment": executable(updateIncentiveSplits),
    "nested-include": executable(getOrderFinanceSummary), "duplicate-identifier": noBusinessIdentifier(getOrderFinanceSummary, "nested-include")
  }),
  IncentiveSplit: defineModel("IncentiveSplit", {
    list: executable(getOrderFinanceSummary), "direct-id": parentManaged(getOrderFinanceSummary, "nested-include", "Incentive splits are nested under incentive detail"),
    search: executable(listRepPerformanceSummaries), aggregate: executable(listRepPerformanceSummaries), create: executable(updateIncentiveSplits),
    update: executable(updateIncentiveSplits), delete: executable(updateIncentiveSplits), "foreign-attachment": executable(updateIncentiveSplits),
    "nested-include": executable(getOrderFinanceSummary), "duplicate-identifier": noBusinessIdentifier(getOrderFinanceSummary, "nested-include")
  })
} as const;
