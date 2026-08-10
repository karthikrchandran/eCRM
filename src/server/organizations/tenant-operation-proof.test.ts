import { describe, expect, it } from "vitest";

import {
  hasCreatedRow,
  hasDuplicateBusinessKey,
  resultContainsIdentity
} from "./tenant-operation-proof";

describe("tenant public-operation semantic proof", () => {
  it("rejects empty or wrong aggregate and nested results", () => {
    expect(resultContainsIdentity([], "matrix_A")).toBe(false);
    expect(resultContainsIdentity({}, "matrix_A")).toBe(false);
    expect(resultContainsIdentity({ count: 1 }, "matrix_A")).toBe(false);
    expect(resultContainsIdentity([{ id: "matrix_B" }], "matrix_A")).toBe(false);
    expect(resultContainsIdentity([{ id: "matrix_A" }], "matrix_A")).toBe(true);
  });

  it("rejects an unrelated mutation as create evidence", () => {
    const before = [{ row: '{"id":"existing_A","name":"Before"}' }];
    const unrelatedUpdate = [{ row: '{"id":"existing_A","name":"After"}' }];
    expect(hasCreatedRow(before, unrelatedUpdate, ["created_A"])).toBe(false);
    expect(hasCreatedRow(before, [...before, { row: '{"id":"created_A"}' }], ["created_A"])).toBe(true);
  });

  it("rejects a preexisting review-item pair as duplicate-key evidence", () => {
    const existingA = [{ row: '{"reviewId":"review_A","taskId":"task_A"}' }];
    const existingB = [{ row: '{"reviewId":"review_B","taskId":"task_B"}' }];
    expect(hasDuplicateBusinessKey(existingA, existingA, existingB, ["task_A"])).toBe(false);
  });
});
