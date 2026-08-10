import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { z } from "zod";
import { getControlPlaneDb } from "@/server/db";
import { membershipSessionVersion, type SessionUser } from "./session";

export class OidcError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OidcError";
  }
}

const claimsSchema = z.object({
  iss: z.string().url(),
  sub: z.string().trim().min(1),
  aud: z.union([z.string().trim().min(1), z.array(z.string().trim().min(1)).min(1)]),
  exp: z.number().int(),
  nonce: z.string().trim().min(1),
  email: z.string().email().optional(),
  email_verified: z.boolean().optional(),
  name: z.string().trim().min(1).optional()
}).passthrough();

export type OidcClaims = z.infer<typeof claimsSchema> & JWTPayload;

export type OidcCallbackInput = {
  claims: OidcClaims;
  expectedIssuer: string;
  expectedAudience: string;
  expectedNonce: string;
  expectedState?: string;
};

type Membership = {
  id: string;
  userId: string;
  organizationId: string;
  role: SessionUser["role"];
  status: "ACTIVE" | "INVITED" | "SUSPENDED" | "REVOKED";
  updatedAt: Date;
  organization: { status: "ACTIVE" | "PROVISIONING" | "SUSPENDED" | "OFFBOARDING" | "DELETED" };
  user: { id: string; name: string; email: string; active: boolean };
};

type OidcDependencies = {
  findMembership?: (issuer: string, subject: string) => Promise<Membership | null>;
};

function audienceMatches(aud: OidcClaims["aud"], expected: string) {
  return Array.isArray(aud) ? aud.includes(expected) : aud === expected;
}

export async function resolveOidcCallback(
  input: OidcCallbackInput,
  dependencies: OidcDependencies = {}
): Promise<SessionUser> {
  const claims = claimsSchema.safeParse(input.claims);
  if (!claims.success) throw new OidcError("Invalid OIDC claims.");
  const value = claims.data;
  if (value.iss !== input.expectedIssuer) throw new OidcError("OIDC issuer mismatch.");
  if (!audienceMatches(value.aud, input.expectedAudience)) throw new OidcError("OIDC audience mismatch.");
  if (value.exp <= Math.floor(Date.now() / 1000)) throw new OidcError("OIDC token expired.");
  if (value.nonce !== input.expectedNonce) throw new OidcError("OIDC nonce mismatch.");
  if (input.expectedState && value.state !== input.expectedState) throw new OidcError("OIDC state mismatch.");

  const findMembership = dependencies.findMembership ?? (async (issuer, subject) => {
    const identity = await getControlPlaneDb().userIdentity.findUnique({
      where: { issuer_subject: { issuer, subject } },
      include: {
        user: {
          include: {
            memberships: {
              where: { status: "ACTIVE", organization: { status: "ACTIVE" } },
              orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
              take: 1,
              include: { organization: true }
            }
          }
        }
      }
    });
    const membership = identity?.user.memberships[0];
    if (!identity || !membership) return null;
    return {
      id: membership.id,
      userId: identity.user.id,
      organizationId: membership.organizationId,
      role: membership.role,
      status: membership.status,
      updatedAt: membership.updatedAt,
      organization: { status: membership.organization.status },
      user: { id: identity.user.id, name: identity.user.name, email: identity.user.email, active: identity.user.active }
    };
  });
  const membership = await findMembership(value.iss, value.sub);
  if (!membership || membership.status !== "ACTIVE" || membership.organization.status !== "ACTIVE" || !membership.user.active) {
    throw new OidcError("No active local membership for this identity.");
  }
  const sessionVersion = membershipSessionVersion(membership.updatedAt);
  if (!Number.isSafeInteger(sessionVersion) || sessionVersion <= 0) throw new OidcError("Invalid membership session version.");
  return {
    id: membership.user.id,
    name: membership.user.name,
    email: membership.user.email,
    organizationId: membership.organizationId,
    membershipId: membership.id,
    role: membership.role,
    sessionVersion
  };
}

export function oidcAuthorizeUrl(options: {
  issuer: string;
  clientId: string;
  redirectUri: string;
  state: string;
  nonce: string;
  codeChallenge: string;
  scope: string;
}) {
  const url = new URL(`${options.issuer.replace(/\/$/, "")}/authorize`);
  url.search = new URLSearchParams({
    response_type: "code",
    client_id: options.clientId,
    redirect_uri: options.redirectUri,
    scope: options.scope,
    state: options.state,
    nonce: options.nonce,
    code_challenge: options.codeChallenge,
    code_challenge_method: "S256"
  }).toString();
  return url;
}

export async function verifyOidcIdToken(token: string, options: { issuer: string; audience: string; nonce: string; jwksUri: string }) {
  try {
    const jwks = createRemoteJWKSet(new URL(options.jwksUri));
    const { payload } = await jwtVerify(token, jwks, { issuer: options.issuer, audience: options.audience });
    const claims = claimsSchema.parse(payload);
    if (claims.nonce !== options.nonce) throw new OidcError("OIDC nonce mismatch.");
    return claims;
  } catch {
    throw new OidcError("OIDC token verification failed.");
  }
}
