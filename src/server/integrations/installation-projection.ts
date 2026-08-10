import { importSPKI, jwtVerify } from "jose";
import type { KeyObject } from "node:crypto";
import { z } from "zod";

const claimsSchema = z.object({
  iss: z.literal("signalloop"),
  aud: z.literal("commitarc"),
  sub: z.string().trim().min(1),
  tenant_key: z.string().trim().min(1),
  key_version: z.number().int().positive(),
  projection_version: z.number().int().positive(),
  jti: z.string().trim().min(1),
  iat: z.number().int(),
  exp: z.number().int()
});

type VerificationKey = Uint8Array | CryptoKey | KeyObject | Record<string, unknown>;

export class InstallationProjectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InstallationProjectionError";
  }
}

export type InstallationProjectionClaims = {
  installationId: string;
  tenantKey: string;
  keyVersion: number;
  projectionVersion: number;
  jti: string;
};

export type InstallationProjection = InstallationProjectionClaims & {
  publicKey: string;
  status: string;
};

export async function verifyInstallationProjection(
  token: string,
  publicKey: VerificationKey | string,
  expected: { tenantKey?: string; keyVersion?: number; minProjectionVersion?: number } = {}
): Promise<InstallationProjectionClaims> {
  try {
    const key = typeof publicKey === "string" ? await importSPKI(publicKey, "EdDSA") : publicKey;
    const header = decodeHeader(token);
    if (header.alg !== "EdDSA" || header.typ !== "JWT" || typeof header.kid !== "string") {
      throw new InstallationProjectionError("invalid projection assertion header");
    }
    const { payload } = await jwtVerify(token, key as never, {
      algorithms: ["EdDSA"],
      issuer: "signalloop",
      audience: "commitarc",
      requiredClaims: ["iss", "aud", "sub", "tenant_key", "key_version", "projection_version", "jti", "iat", "exp"],
      clockTolerance: 30
    });
    const claims = claimsSchema.parse(payload);
    if (claims.exp - claims.iat > 120 || claims.exp < Math.floor(Date.now() / 1000) - 30 || claims.iat > Math.floor(Date.now() / 1000) + 30) {
      throw new InstallationProjectionError("invalid projection assertion lifetime");
    }
    if (expected.tenantKey && claims.tenant_key !== expected.tenantKey) throw new InstallationProjectionError("tenant mismatch");
    if (expected.keyVersion !== undefined && claims.key_version !== expected.keyVersion) throw new InstallationProjectionError("key version mismatch");
    if (expected.minProjectionVersion !== undefined && claims.projection_version < expected.minProjectionVersion) throw new InstallationProjectionError("stale projection");
    return {
      installationId: claims.sub,
      tenantKey: claims.tenant_key,
      keyVersion: claims.key_version,
      projectionVersion: claims.projection_version,
      jti: claims.jti
    };
  } catch (error) {
    if (error instanceof InstallationProjectionError) throw error;
    throw new InstallationProjectionError("invalid projection assertion");
  }
}

function decodeHeader(token: string) {
  const encoded = token.split(".")[0];
  if (!encoded) throw new InstallationProjectionError("invalid projection assertion");
  return JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as Record<string, unknown>;
}

type ExistingInstallation = { installationId: string; tenantKey: string; keyVersion: number; status: string; lastAppliedVersion: number } | null;
type ProjectionRepository = {
  get: (installationId: string) => Promise<ExistingInstallation>;
  hasReplay: (installationId: string, jti: string) => Promise<boolean>;
  save: (value: Record<string, unknown>) => Promise<void>;
};

export async function applyInstallationProjection(
  projection: InstallationProjection,
  repository: ProjectionRepository
) {
  const existing = await repository.get(projection.installationId);
  if (existing && existing.tenantKey !== projection.tenantKey) throw new InstallationProjectionError("tenant mismatch");
  if (existing && projection.projectionVersion < existing.lastAppliedVersion) throw new InstallationProjectionError("stale projection");
  if (await repository.hasReplay(projection.installationId, projection.jti)) return { applied: false, projectionVersion: projection.projectionVersion };
  await repository.save({ ...projection, lastAppliedVersion: projection.projectionVersion });
  return { applied: true, projectionVersion: projection.projectionVersion };
}
