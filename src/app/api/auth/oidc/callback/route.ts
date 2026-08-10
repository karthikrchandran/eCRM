import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { getServerEnv } from "@/server/env";
import { getControlPlaneDb } from "@/server/db";
import { OidcError, resolveOidcCallback, verifyOidcIdToken } from "@/server/auth/oidc";
import { SESSION_COOKIE_NAME, shouldUseSecureSessionCookie, signSession } from "@/server/auth/session";
import { TX_COOKIE } from "../start/route";

function secret(value: string) {
  return new TextEncoder().encode(value);
}

function parseCookie(value: string | undefined) {
  if (!value) throw new OidcError("OIDC transaction is missing.");
  return jwtVerify(value, secret(getServerEnv().AUTH_SECRET), {
    issuer: "ecrm-oidc",
    audience: "ecrm-oidc-transaction",
    algorithms: ["HS256"]
  }).then(({ payload }) => {
    if (typeof payload.state !== "string" || typeof payload.nonce !== "string" || typeof payload.verifier !== "string") {
      throw new OidcError("OIDC transaction is invalid.");
    }
    return { state: payload.state, nonce: payload.nonce, verifier: payload.verifier };
  }).catch(() => { throw new OidcError("OIDC transaction is invalid or expired."); });
}

export async function GET(request: Request) {
  try {
    const env = getServerEnv();
    if (env.AUTH_MODE !== "oidc" || !env.OIDC_ISSUER || !env.OIDC_CLIENT_ID || !env.OIDC_CLIENT_SECRET || !env.OIDC_REDIRECT_URI || !env.OIDC_AUDIENCE) {
      return Response.json({ error: "OIDC authentication is not configured." }, { status: 503 });
    }
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    if (!code || !state) throw new OidcError("OIDC callback parameters are missing.");
    const transaction = await parseCookie((await cookies()).get(TX_COOKIE)?.value);
    if (transaction.state !== state) throw new OidcError("OIDC state mismatch.");

    const tokenResponse = await fetch(`${env.OIDC_ISSUER.replace(/\/$/, "")}/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: env.OIDC_REDIRECT_URI, client_id: env.OIDC_CLIENT_ID, client_secret: env.OIDC_CLIENT_SECRET, code_verifier: transaction.verifier })
    });
    if (!tokenResponse.ok) throw new OidcError("OIDC token exchange failed.");
    const token = (await tokenResponse.json()) as { id_token?: string };
    if (!token.id_token) throw new OidcError("OIDC identity token is missing.");
    const claims = await verifyOidcIdToken(token.id_token, {
      issuer: env.OIDC_ISSUER,
      audience: env.OIDC_AUDIENCE,
      nonce: transaction.nonce,
      jwksUri: env.OIDC_JWKS_URI ?? `${env.OIDC_ISSUER.replace(/\/$/, "")}/.well-known/jwks.json`
    });
    const session = await resolveOidcCallback({ claims, expectedIssuer: env.OIDC_ISSUER, expectedAudience: env.OIDC_AUDIENCE, expectedNonce: transaction.nonce }, {
      findMembership: async (issuer, subject) => {
        const identity = await getControlPlaneDb().userIdentity.findUnique({
          where: { issuer_subject: { issuer, subject } },
          include: { user: { include: { memberships: { where: { status: "ACTIVE", organization: { status: "ACTIVE" } }, orderBy: [{ updatedAt: "desc" }, { id: "asc" }], take: 1, include: { organization: true } } } } }
        });
        const membership = identity?.user.memberships[0];
        return identity && membership ? { id: membership.id, userId: identity.user.id, organizationId: membership.organizationId, role: membership.role, status: membership.status, updatedAt: membership.updatedAt, organization: { status: membership.organization.status }, user: { id: identity.user.id, name: identity.user.name, email: identity.user.email, active: identity.user.active } } : null;
      }
    });
    await getControlPlaneDb().userIdentity.update({ where: { issuer_subject: { issuer: env.OIDC_ISSUER, subject: claims.sub } }, data: { lastLoginAt: new Date() } });
    const signed = await signSession(session);
    const response = Response.redirect(new URL("/home", env.APP_BASE_URL));
    response.headers.append("Set-Cookie", `${SESSION_COOKIE_NAME}=${signed}; HttpOnly; Path=/; SameSite=Lax; Max-Age=28800${shouldUseSecureSessionCookie(env.APP_BASE_URL) ? "; Secure" : ""}`);
    response.headers.append("Set-Cookie", `${TX_COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`);
    return response;
  } catch (error) {
    const message = error instanceof OidcError ? error.message : "Unable to complete OIDC sign-in.";
    return Response.json({ error: message }, { status: error instanceof OidcError ? 403 : 500 });
  }
}
