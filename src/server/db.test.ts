import { describe, expect, it, vi } from "vitest";

import * as databaseModule from "./db";
import { createControlPlanePrismaClient } from "./db";

describe("control-plane database client", () => {
  it("does not expose the legacy generic owner-capable db alias", () => {
    expect("db" in databaseModule).toBe(false);
  });

  it("fails closed without CONTROL_PLANE_DATABASE_URL", () => {
    const createClient = vi.fn();
    expect(() => createControlPlanePrismaClient("", createClient)).toThrow(
      "CONTROL_PLANE_DATABASE_URL is required for runtime identity and organization access."
    );
    expect(createClient).not.toHaveBeenCalled();
  });

  it("constructs only from the explicit control-plane URL", () => {
    const client = { user: {} };
    const createClient = vi.fn().mockReturnValue(client);
    const url = "postgresql://control_login@127.0.0.1:55459/ecrm_wp4_test?schema=public";
    expect(createControlPlanePrismaClient(url, createClient)).toBe(client);
    expect(createClient).toHaveBeenCalledWith(expect.objectContaining({ datasourceUrl: url }));
  });
});
