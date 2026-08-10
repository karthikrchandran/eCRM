import { describe, expect, it } from "vitest";

import {
  hasCreatedRow,
  hasDuplicateBusinessKey,
  resultHasExactEvidence
} from "./tenant-operation-proof";

describe("tenant public-operation semantic proof", () => {
  it("rejects empty or wrong aggregate and nested results", () => {
    expect(resultHasExactEvidence([], [{ path: ["*", "id"], value: "matrix_A" }])).toBe(false);
    expect(resultHasExactEvidence({}, [{ path: ["id"], value: "matrix_A" }])).toBe(false);
    expect(resultHasExactEvidence({ count: 0 }, [{ path: ["count"], value: 1 }])).toBe(false);
    expect(resultHasExactEvidence([{ id: "matrix_A_suffix" }], [{ path: ["*", "id"], value: "matrix_A" }])).toBe(false);
    expect(resultHasExactEvidence([{ id: "matrix_A" }], [{ path: ["*", "id"], value: "matrix_A" }])).toBe(true);
  });

  it("rejects an unrelated mutation as create evidence", () => {
    const before = [{ row: '{"id":"existing_A","name":"Before"}' }];
    const unrelatedUpdate = [{ row: '{"id":"existing_A","name":"After"}' }];
    expect(hasCreatedRow(before, unrelatedUpdate, [{ path: ["id"], value: "created_A" }])).toBe(false);
    expect(hasCreatedRow(before, [...before, { row: '{"id":"created_A"}' }], [{ path: ["id"], value: "created_A" }])).toBe(true);
    expect(hasCreatedRow(before, [...before, { row: '{"id":"created_A","organizationId":"org_A"}' }], [{ path: ["organizationId"], value: "org_A" }])).toBe(false);
  });

  it("rejects a preexisting review-item pair as duplicate-key evidence", () => {
    const keyA = [{ path: ["externalKey"], value: "same-key" }];
    const keyB = [{ path: ["externalKey"], value: "same-key" }];
    const existingA = [{ row: '{"id":"a","externalKey":"same-key"}' }];
    const existingB = [{ row: '{"id":"b","externalKey":"same-key"}' }];
    const unrelatedB = [{ row: '{"id":"b","externalKey":"other-key"}' }];
    const createdA = [{ row: '{"id":"new-a","externalKey":"same-key"}' }];
    expect(hasDuplicateBusinessKey(existingA, existingA, existingB, existingB, keyA, keyB)).toBe(false);
    expect(hasDuplicateBusinessKey([], createdA, unrelatedB, unrelatedB, keyA, keyB)).toBe(false);
    expect(hasDuplicateBusinessKey([], createdA, existingB, [{ row: '{"id":"b","externalKey":"mutated"}' }], keyA, keyB)).toBe(false);
    expect(hasDuplicateBusinessKey([], createdA, existingB, existingB, keyA, keyB)).toBe(true);
  });
});
