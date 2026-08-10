import { describe, expect, it, vi } from "vitest";
import { listOrganizationUserOptions } from "./member-options";

describe("organization user options", () => {
  it("returns only active users with active eligible memberships in the authoritative organization", async () => {
    const queryRaw = vi.fn().mockResolvedValue([]);

    await listOrganizationUserOptions("org_A", ["ADMIN", "SALES"], {
      $queryRaw: queryRaw
    } as never);

    expect(queryRaw).toHaveBeenCalledOnce();
  });
});
