// @vitest-environment node
import { describe, expect, it } from "vitest";
import { CompactSign } from "jose";
import { generateKeyPairSync } from "node:crypto";
import { TextEncoder } from "node:util";
import {
  InstallationProjectionError,
  applyInstallationProjection,
  verifyInstallationProjection
} from "./installation-projection";

async function signed(overrides: Record<string, unknown> = {}) {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const claims = {
    iss: "signalloop", aud: "commitarc", iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 120,
    sub: "install-1",
    tenant_key: "tenant-a",
    key_version: 2,
    projection_version: 3,
    jti: "jti-1",
    ...overrides
  };
  const token = await new CompactSign(new TextEncoder().encode(JSON.stringify(claims)))
    .setProtectedHeader({ alg: "EdDSA", typ: "JWT", kid: "key-2" })
    .sign(privateKey);
  return { token, publicKey };
}

describe("installation projection assertions", () => {
  it("verifies tenant-bound EdDSA assertions", async () => {
    const { token, publicKey } = await signed();
    await expect(verifyInstallationProjection(token, publicKey)).resolves.toMatchObject({
      installationId: "install-1",
      tenantKey: "tenant-a",
      keyVersion: 2,
      projectionVersion: 3
    });
  });

  it.each([
    ["wrong tenant", { tenant_key: "tenant-b" }],
    ["wrong key version", { key_version: 1 }],
    ["stale projection", { projection_version: 0 }]
  ])("rejects %s", async (_label, overrides) => {
    const { token, publicKey } = await signed(overrides);
    await expect(verifyInstallationProjection(token, publicKey, { tenantKey: "tenant-a", keyVersion: 2, minProjectionVersion: 1 })).rejects.toBeInstanceOf(InstallationProjectionError);
  });

  it("applies a projection once and returns idempotent replay", async () => {
    const writes: Array<Record<string, unknown>> = [];
    const repo = {
      get: async () => ({ installationId: "install-1", tenantKey: "tenant-a", keyVersion: 1, status: "ACTIVE", lastAppliedVersion: 1 }),
      hasReplay: async () => writes.length > 0,
      save: async (value: Record<string, unknown>) => { writes.push(value); }
    };
    const projection = { installationId: "install-1", tenantKey: "tenant-a", keyVersion: 2, projectionVersion: 3, jti: "jti-1", publicKey: "pk", status: "ACTIVE" };
    await expect(applyInstallationProjection(projection, repo)).resolves.toEqual({ applied: true, projectionVersion: 3 });
    await expect(applyInstallationProjection(projection, repo)).resolves.toEqual({ applied: false, projectionVersion: 3 });
    expect(writes).toHaveLength(1);
  });
});
