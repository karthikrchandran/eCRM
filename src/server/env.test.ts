import { afterEach, describe, expect, it, vi } from "vitest";

import { getServerEnv } from "./env";

const originalEnv = { ...process.env };

afterEach(() => {
  vi.unstubAllEnvs();
  process.env = { ...originalEnv };
});

function setValidServerEnv() {
  process.env = {
    NODE_ENV: "test",
    DATABASE_URL: "postgresql://ecrm:ecrm@localhost:54329/ecrm?schema=public",
    AUTH_SECRET: "replace-with-at-least-32-characters",
    APP_BASE_URL: "http://localhost:3000"
  };
}

describe("getServerEnv", () => {
  it("parses required server environment and defaults the app base URL", () => {
    setValidServerEnv();
    delete process.env.APP_BASE_URL;
    delete process.env.APP_MODE;
    delete process.env.CELL_ID;
    delete process.env.CELL_KEY;

    expect(getServerEnv()).toEqual({
      DATABASE_URL: "postgresql://ecrm:ecrm@localhost:54329/ecrm?schema=public",
      AUTH_SECRET: "replace-with-at-least-32-characters",
      APP_BASE_URL: "http://localhost:3000",
      runtime: { mode: "platform" }
    });
  });

  it("parses explicit cell runtime configuration", () => {
    setValidServerEnv();
    process.env.APP_MODE = "cell";
    process.env.CELL_ID = "cell_ara";
    process.env.CELL_KEY = "ara-global";

    expect(getServerEnv()).toMatchObject({
      runtime: { mode: "cell", cellId: "cell_ara", cellKey: "ara-global" }
    });
  });

  it("requires explicit runtime mode in production", () => {
    setValidServerEnv();
    vi.stubEnv("NODE_ENV", "production");
    delete process.env.APP_MODE;

    expect(() => getServerEnv()).toThrow("APP_MODE must be explicit in production");
  });

  it.each([
    ["missing", undefined, "CELL_KEY is required"],
    ["invalid", "Ara Global", "CELL_KEY must match ^[a-z0-9-]+$"]
  ])("rejects %s cell keys", (_label, cellKey, expectedError) => {
    setValidServerEnv();
    process.env.APP_MODE = "cell";
    process.env.CELL_ID = "cell_ara";

    if (cellKey === undefined) {
      delete process.env.CELL_KEY;
    } else {
      process.env.CELL_KEY = cellKey;
    }

    expect(() => getServerEnv()).toThrow(expectedError);
  });

  it("resets generic validation fixtures from a malformed host cell configuration", () => {
    process.env = {
      NODE_ENV: "test",
      DATABASE_URL: "postgresql://ecrm:ecrm@localhost:54329/ecrm?schema=public",
      AUTH_SECRET: "replace-with-at-least-32-characters",
      APP_BASE_URL: "http://localhost:3000",
      APP_MODE: "cell"
    };

    setValidServerEnv();

    expect(getServerEnv()).toMatchObject({ runtime: { mode: "platform" } });
  });

  it("rejects auth secrets shorter than 32 characters", () => {
    setValidServerEnv();
    process.env.AUTH_SECRET = "short";

    expect(() => getServerEnv()).toThrow();
  });

  it.each([
    ["missing", undefined],
    ["empty", ""],
    ["blank", "   "]
  ])("rejects %s database URLs", (_label, databaseUrl) => {
    setValidServerEnv();

    if (databaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = databaseUrl;
    }

    expect(() => getServerEnv()).toThrow();
  });

  it("rejects invalid app base URLs", () => {
    setValidServerEnv();
    process.env.APP_BASE_URL = "not-a-url";

    expect(() => getServerEnv()).toThrow();
  });
});
