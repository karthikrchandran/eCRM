import { describe, expect, it, vi } from "vitest";

import { authorizePlatformAdmin } from "./admin-auth";

const token = "p".repeat(48);

describe("platform administrator authorization", () => {
  it("returns 404 before inspecting credentials outside platform mode", () => {
    const compare = vi.fn<(left: Uint8Array, right: Uint8Array) => boolean>(() => true);
    const result = authorizePlatformAdmin(
      new Request("http://localhost/api/platform/cells", {
        headers: { authorization: `Bearer ${token}`, "x-platform-actor": "operator@example.com" }
      }),
      { APP_MODE: "cell", PLATFORM_ADMIN_TOKEN: token, PLATFORM_ADMIN_ACTOR: "configured@example.com" },
      compare
    );

    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(404);
    expect(compare).not.toHaveBeenCalled();
  });

  it.each([
    ["missing", undefined],
    ["wrong", "not-the-platform-token"]
  ])("fails closed for a %s credential and still performs a fixed-length comparison", (_label, candidate) => {
    const compare = vi.fn<(left: Uint8Array, right: Uint8Array) => boolean>(() => false);
    const headers: Record<string, string> = { "x-platform-actor": "operator@example.com" };
    if (candidate) headers.authorization = `Bearer ${candidate}`;

    const result = authorizePlatformAdmin(
      new Request("http://localhost/api/platform/cells", { headers }),
      { APP_MODE: "platform", PLATFORM_ADMIN_TOKEN: token, PLATFORM_ADMIN_ACTOR: "configured@example.com" },
      compare
    );

    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(401);
    expect(compare).toHaveBeenCalledOnce();
    expect(compare.mock.calls[0][0]).toHaveLength(32);
    expect(compare.mock.calls[0][1]).toHaveLength(32);
  });

  it("accepts the configured secure token and binds the configured actor", () => {
    const result = authorizePlatformAdmin(
      new Request("http://localhost/api/platform/cells", {
        headers: { authorization: `Bearer ${token}`, "x-platform-actor": "spoofed@example.com" }
      }),
      { APP_MODE: "platform", PLATFORM_ADMIN_TOKEN: token, PLATFORM_ADMIN_ACTOR: "configured@example.com" }
    );

    expect(result).toEqual({ actor: "configured@example.com" });
  });

  it("rejects a valid token when its credential has no configured actor", () => {
    const result = authorizePlatformAdmin(
      new Request("http://localhost/api/platform/cells", {
        headers: { authorization: `Bearer ${token}`, "x-platform-actor": "spoofed@example.com" }
      }),
      { APP_MODE: "platform", PLATFORM_ADMIN_TOKEN: token }
    );

    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(401);
  });

  it("rejects an insecurely short configured token", () => {
    const result = authorizePlatformAdmin(
      new Request("http://localhost/api/platform/cells", {
        headers: { authorization: "Bearer short", "x-platform-actor": "operator@example.com" }
      }),
      { APP_MODE: "platform", PLATFORM_ADMIN_TOKEN: "short", PLATFORM_ADMIN_ACTOR: "configured@example.com" }
    );

    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(401);
  });
});
