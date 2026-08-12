import { randomUUID } from "node:crypto";

import { jwtVerify, SignJWT } from "jose";

import type { RuntimeConfig } from "@/server/runtime/cell-config";

export const supportCapabilities = ["configuration:read", "users:read"] as const;
export type SupportCapability = typeof supportCapabilities[number];

export type SupportGrantProjection = {
  id: string;
  cellId: string;
  operatorId: string;
  caseReference: string;
  capabilities: readonly string[];
  startsAt: Date;
  expiresAt: Date;
  revokedAt?: Date;
};

type SupportAudit = {
  id: string;
  actorId: string;
  action: string;
  targetType: "SupportGrant";
  targetId: string;
  correlationId: string;
  reason: string;
  result: "SUCCEEDED" | "FAILED";
  error?: string;
  occurredAt: Date;
};

export class SupportAccessDeniedError extends Error {
  public constructor(message = "Support access denied") {
    super(message);
    this.name = "SupportAccessDeniedError";
  }
}

export async function issueSupportAccessToken(grant: SupportGrantProjection, secret: string): Promise<string> {
  if (secret.length < 32) throw new Error("SUPPORT_ACCESS_SECRET must be at least 32 characters");
  return new SignJWT({
    grantId: grant.id,
    cellId: grant.cellId,
    operatorId: grant.operatorId,
    caseReference: grant.caseReference,
    capabilities: [...grant.capabilities]
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer("ecrm-platform")
    .setAudience("ecrm-cell")
    .setIssuedAt(Math.floor(grant.startsAt.getTime() / 1000))
    .setExpirationTime(Math.floor(grant.expiresAt.getTime() / 1000))
    .sign(new TextEncoder().encode(secret));
}

export async function authorizeSupportAccess(
  request: Request,
  capability: string,
  dependencies: {
    runtime: RuntimeConfig;
    secret: string;
    now?: () => Date;
    findControl(cellId: string): Promise<{ cellId: string; lifecycleStatus: string } | undefined>;
    findGrant(grantId: string): Promise<SupportGrantProjection | undefined>;
    audit(event: SupportAudit): Promise<void> | void;
  }
) {
  const now = dependencies.now?.() ?? new Date();
  const actorId = request.headers.get("x-support-operator-id") ?? "unknown";
  let targetId = "unknown";
  const correlationId = request.headers.get("x-correlation-id") ?? `support_${randomUUID()}`;
  try {
    if (dependencies.runtime.mode !== "cell") throw new SupportAccessDeniedError();
    const control = await dependencies.findControl(dependencies.runtime.cellId);
    if (control?.cellId !== dependencies.runtime.cellId || control.lifecycleStatus !== "ACTIVE") throw new SupportAccessDeniedError();
    if (!supportCapabilities.includes(capability as SupportCapability)) throw new SupportAccessDeniedError();
    const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token || dependencies.secret.length < 32) throw new SupportAccessDeniedError();
    const verified = await jwtVerify(token, new TextEncoder().encode(dependencies.secret), {
      algorithms: ["HS256"], issuer: "ecrm-platform", audience: "ecrm-cell", currentDate: now
    });
    const claims = verified.payload as Record<string, unknown>;
    targetId = typeof claims.grantId === "string" ? claims.grantId : "unknown";
    const grant = await dependencies.findGrant(targetId);
    const caseReference = request.headers.get("x-support-case-reference");
    const tokenCapabilities = Array.isArray(claims.capabilities) ? claims.capabilities : [];
    const valid = grant
      && claims.cellId === dependencies.runtime.cellId
      && claims.operatorId === actorId
      && claims.caseReference === caseReference
      && grant.cellId === dependencies.runtime.cellId
      && grant.operatorId === actorId
      && grant.caseReference === caseReference
      && grant.startsAt <= now && grant.expiresAt > now && !grant.revokedAt
      && grant.capabilities.includes(capability) && tokenCapabilities.includes(capability);
    if (!valid) throw new SupportAccessDeniedError();
    await dependencies.audit({
      id: `audit_${randomUUID()}`, actorId, action: `support-access.${capability}`, targetType: "SupportGrant",
      targetId, correlationId, reason: `Support case ${caseReference}`, result: "SUCCEEDED", occurredAt: now
    });
    return { grantId: targetId, operatorId: actorId, caseReference, capability };
  } catch (error) {
    await dependencies.audit({
      id: `audit_${randomUUID()}`, actorId, action: `support-access.${capability}`, targetType: "SupportGrant",
      targetId, correlationId, reason: "Support access rejected", result: "FAILED", error: "SUPPORT_ACCESS_DENIED", occurredAt: now
    });
    if (error instanceof SupportAccessDeniedError) throw error;
    throw new SupportAccessDeniedError();
  }
}
