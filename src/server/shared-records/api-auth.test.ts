import { afterEach, describe, expect, it } from "vitest";

import { requireSharedDataApiToken } from "./api-auth";

const originalToken = process.env.SHARED_DATA_API_TOKEN;

afterEach(() => {
  if (originalToken === undefined) {
    delete process.env.SHARED_DATA_API_TOKEN;
  } else {
    process.env.SHARED_DATA_API_TOKEN = originalToken;
  }
});

describe("requireSharedDataApiToken", () => {
  it("returns null when the bearer token matches the configured shared token", () => {
    process.env.SHARED_DATA_API_TOKEN = "shared-secret";
    const request = new Request("http://localhost/api/shared-records", {
      headers: { authorization: "Bearer shared-secret" }
    });

    expect(requireSharedDataApiToken(request)).toBeNull();
  });

  it("rejects missing or invalid bearer tokens", async () => {
    process.env.SHARED_DATA_API_TOKEN = "shared-secret";

    const missing = requireSharedDataApiToken(new Request("http://localhost/api/shared-records"));
    const invalid = requireSharedDataApiToken(
      new Request("http://localhost/api/shared-records", {
        headers: { authorization: "Bearer wrong-secret" }
      })
    );

    expect(missing?.status).toBe(401);
    await expect(missing?.json()).resolves.toEqual({ error: "Unauthorized." });
    expect(invalid?.status).toBe(401);
  });

  it("fails closed when the shared token is not configured", async () => {
    delete process.env.SHARED_DATA_API_TOKEN;

    const response = requireSharedDataApiToken(
      new Request("http://localhost/api/shared-records", {
        headers: { authorization: "Bearer shared-secret" }
      })
    );

    expect(response?.status).toBe(500);
    await expect(response?.json()).resolves.toEqual({ error: "Shared data API token is not configured." });
  });
});
