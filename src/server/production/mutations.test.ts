import { describe, expect, it, vi } from "vitest";
import { instantiateProductionForOrderLineItem, updateProductionStageStatus } from "./mutations";

const actor = { id: "user_sales", role: "SALES" as const };

const orderLineItem = {
  id: "order_line_1",
  orderId: "order_1",
  productNameSnapshot: "Custom eLearning module",
  productCategorySnapshot: "eLearning",
  productionTemplateKeySnapshot: "elearning",
  order: {
    id: "order_1",
    orderNumber: "ORD-0001",
    status: "BOOKED" as const
  }
};

const productionTemplate = {
  id: "template_1",
  key: "elearning",
  stages: [
    {
      id: "template_stage_script",
      name: "Script",
      description: "Write the script",
      required: true,
      sortOrder: 10
    },
    {
      id: "template_stage_review",
      name: "Review",
      description: null,
      required: true,
      sortOrder: 20
    }
  ]
};

describe("production mutations", () => {
  it("instantiates one work item from an order line item and expands template stages", async () => {
    const create = vi.fn().mockResolvedValue({ id: "work_item_1" });

    const workItem = await instantiateProductionForOrderLineItem(actor, "order_line_1", {
      orderLineItem: {
        findUnique: vi.fn().mockResolvedValue(orderLineItem)
      },
      productionTemplate: {
        findUnique: vi.fn().mockResolvedValue(productionTemplate)
      },
      productionWorkItem: {
        findFirst: vi.fn().mockResolvedValue(null),
        create,
        findMany: vi.fn().mockResolvedValue([{ id: "work_item_1", status: "NOT_STARTED" }])
      },
      order: { update: vi.fn() },
      $transaction: async (callback) =>
        callback({
          productionWorkItem: {
            create,
            findMany: vi.fn().mockResolvedValue([{ id: "work_item_1", status: "NOT_STARTED" }])
          },
          order: { update: vi.fn() }
        })
    });

    expect(workItem).toEqual({ id: "work_item_1" });
    expect(create).toHaveBeenCalledWith({
      data: {
        orderLineItemId: "order_line_1",
        productionTemplateId: "template_1",
        title: "ORD-0001 - Custom eLearning module",
        productNameSnapshot: "Custom eLearning module",
        productCategorySnapshot: "eLearning",
        status: "NOT_STARTED",
        createdById: "user_sales",
        updatedById: "user_sales",
        stageInstances: {
          create: [
            {
              templateStageId: "template_stage_script",
              name: "Script",
              description: "Write the script",
              required: true,
              sortOrder: 10,
              status: "NOT_STARTED"
            },
            {
              templateStageId: "template_stage_review",
              name: "Review",
              description: null,
              required: true,
              sortOrder: 20,
              status: "NOT_STARTED"
            }
          ]
        }
      }
    });
  });

  it("returns the existing work item instead of creating a duplicate for the same line item", async () => {
    const existing = { id: "work_item_existing" };
    const create = vi.fn();

    const workItem = await instantiateProductionForOrderLineItem(actor, "order_line_1", {
      orderLineItem: { findUnique: vi.fn() },
      productionTemplate: { findUnique: vi.fn() },
      productionWorkItem: {
        findFirst: vi.fn().mockResolvedValue(existing),
        create,
        findMany: vi.fn()
      },
      order: { update: vi.fn() },
      $transaction: vi.fn()
    });

    expect(workItem).toBe(existing);
    expect(create).not.toHaveBeenCalled();
  });

  it("updates a stage to done with timestamps, a note, and conservative parent statuses", async () => {
    const now = new Date("2026-06-15T15:30:00.000Z");
    const stageUpdate = vi.fn().mockResolvedValue({ id: "stage_1", status: "DONE" });
    const noteCreate = vi.fn().mockResolvedValue({ id: "note_1" });
    const workItemUpdate = vi.fn().mockResolvedValue({ id: "work_item_1", status: "DONE" });
    const orderUpdate = vi.fn().mockResolvedValue({ id: "order_1", status: "READY_FOR_DELIVERY" });

    const result = await updateProductionStageStatus(
      actor,
      "stage_1",
      { status: "DONE", noteBody: "Script signed off" },
      {
        productionStageInstance: {
          findUnique: vi.fn().mockResolvedValue({
            id: "stage_1",
            workItemId: "work_item_1",
            status: "IN_PROGRESS",
            startedAt: new Date("2026-06-15T14:00:00.000Z"),
            workItem: {
              id: "work_item_1",
              orderLineItem: {
                orderId: "order_1",
                order: { id: "order_1", status: "IN_PRODUCTION" }
              }
            }
          }),
          update: stageUpdate,
          findMany: vi.fn().mockResolvedValue([
            { id: "stage_1", status: "DONE", startedAt: now, completedAt: now },
            { id: "stage_2", status: "SKIPPED", startedAt: null, completedAt: now }
          ])
        },
        productionNote: { create: noteCreate },
        productionWorkItem: {
          update: workItemUpdate,
          findMany: vi.fn().mockResolvedValue([{ id: "work_item_1", status: "DONE" }])
        },
        order: { update: orderUpdate },
        $transaction: async (callback) =>
          callback({
            productionStageInstance: {
              update: stageUpdate,
              findMany: vi.fn().mockResolvedValue([
                { id: "stage_1", status: "DONE", startedAt: now, completedAt: now },
                { id: "stage_2", status: "SKIPPED", startedAt: null, completedAt: now }
              ])
            },
            productionNote: { create: noteCreate },
            productionWorkItem: {
              update: workItemUpdate,
              findMany: vi.fn().mockResolvedValue([{ id: "work_item_1", status: "DONE" }])
            },
            order: { update: orderUpdate }
          }),
        now: () => now
      }
    );

    expect(stageUpdate).toHaveBeenCalledWith({
      where: { id: "stage_1" },
      data: {
        status: "DONE",
        startedAt: new Date("2026-06-15T14:00:00.000Z"),
        completedAt: now,
        completedById: "user_sales",
        skippedReason: null
      }
    });
    expect(noteCreate).toHaveBeenCalledWith({
      data: {
        workItemId: "work_item_1",
        stageInstanceId: "stage_1",
        body: "Script signed off",
        createdById: "user_sales"
      }
    });
    expect(workItemUpdate).toHaveBeenCalledWith({
      where: { id: "work_item_1" },
      data: {
        status: "DONE",
        startedAt: now,
        completedAt: now,
        updatedById: "user_sales"
      }
    });
    expect(orderUpdate).toHaveBeenCalledWith({
      where: { id: "order_1" },
      data: { status: "READY_FOR_DELIVERY", updatedById: "user_sales" }
    });
    expect(result).toEqual({ id: "stage_1", status: "DONE" });
  });

  it("marks a blocked stage as in production for the work item and order", async () => {
    const now = new Date("2026-06-15T16:00:00.000Z");
    const stageUpdate = vi.fn().mockResolvedValue({ id: "stage_1", status: "BLOCKED" });
    const workItemUpdate = vi.fn().mockResolvedValue({ id: "work_item_1", status: "BLOCKED" });
    const orderUpdate = vi.fn().mockResolvedValue({ id: "order_1", status: "IN_PRODUCTION" });

    await updateProductionStageStatus(
      actor,
      "stage_1",
      { status: "BLOCKED" },
      {
        productionStageInstance: {
          findUnique: vi.fn().mockResolvedValue({
            id: "stage_1",
            workItemId: "work_item_1",
            status: "NOT_STARTED",
            startedAt: null,
            workItem: {
              id: "work_item_1",
              orderLineItem: {
                orderId: "order_1",
                order: { id: "order_1", status: "BOOKED" }
              }
            }
          }),
          update: stageUpdate,
          findMany: vi.fn().mockResolvedValue([
            { id: "stage_1", status: "BLOCKED", startedAt: now, completedAt: null },
            { id: "stage_2", status: "NOT_STARTED", startedAt: null, completedAt: null }
          ])
        },
        productionNote: { create: vi.fn() },
        productionWorkItem: {
          update: workItemUpdate,
          findMany: vi.fn().mockResolvedValue([{ id: "work_item_1", status: "BLOCKED" }])
        },
        order: { update: orderUpdate },
        $transaction: async (callback) =>
          callback({
            productionStageInstance: {
              update: stageUpdate,
              findMany: vi.fn().mockResolvedValue([
                { id: "stage_1", status: "BLOCKED", startedAt: now, completedAt: null },
                { id: "stage_2", status: "NOT_STARTED", startedAt: null, completedAt: null }
              ])
            },
            productionNote: { create: vi.fn() },
            productionWorkItem: {
              update: workItemUpdate,
              findMany: vi.fn().mockResolvedValue([{ id: "work_item_1", status: "BLOCKED" }])
            },
            order: { update: orderUpdate }
          }),
        now: () => now
      }
    );

    expect(stageUpdate).toHaveBeenCalledWith({
      where: { id: "stage_1" },
      data: {
        status: "BLOCKED",
        startedAt: now,
        completedAt: null,
        completedById: null,
        skippedReason: null
      }
    });
    expect(workItemUpdate).toHaveBeenCalledWith({
      where: { id: "work_item_1" },
      data: {
        status: "BLOCKED",
        startedAt: now,
        completedAt: null,
        updatedById: "user_sales"
      }
    });
    expect(orderUpdate).toHaveBeenCalledWith({
      where: { id: "order_1" },
      data: { status: "IN_PRODUCTION", updatedById: "user_sales" }
    });
  });
});
