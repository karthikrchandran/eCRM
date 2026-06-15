import { afterEach, describe, expect, it } from "vitest";

import { getServerEnv } from "./env";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("getServerEnv", () => {
  it("parses required server environment and defaults the app base URL", () => {
    process.env.DATABASE_URL = "postgresql://ecrm:ecrm@localhost:54329/ecrm?schema=public";
    process.env.AUTH_SECRET = "replace-with-at-least-32-characters";
    delete process.env.APP_BASE_URL;

    expect(getServerEnv()).toEqual({
      DATABASE_URL: "postgresql://ecrm:ecrm@localhost:54329/ecrm?schema=public",
      AUTH_SECRET: "replace-with-at-least-32-characters",
      APP_BASE_URL: "http://localhost:3000"
    });
  });

  it("rejects auth secrets shorter than 32 characters", () => {
    process.env.DATABASE_URL = "postgresql://ecrm:ecrm@localhost:54329/ecrm?schema=public";
    process.env.AUTH_SECRET = "short";
    process.env.APP_BASE_URL = "http://localhost:3000";

    expect(() => getServerEnv()).toThrow();
  });
});
