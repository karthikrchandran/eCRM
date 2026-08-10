import { randomBytes } from "node:crypto";
import { getServerEnv } from "@/server/env";
import { createOidcTransaction, oidcAuthorizeUrl } from "@/server/auth/oidc";

const TX_COOKIE = "ecrm_oidc_tx";

function base64url(value: Uint8Array) {
  return Buffer.from(value).toString("base64url");
}

export async function GET() {
  const env = getServerEnv();
  if (env.AUTH_MODE !== "oidc" || !env.OIDC_ISSUER || !env.OIDC_CLIENT_ID || !env.OIDC_REDIRECT_URI || !env.OIDC_AUDIENCE) {
    return Response.json({ error: "OIDC authentication is not configured." }, { status: 503 });
  }
  const state = base64url(randomBytes(32));
  const nonce = base64url(randomBytes(32));
  const verifier = base64url(randomBytes(48));
  const challenge = base64url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))));
  const transaction = await createOidcTransaction(env.AUTH_SECRET, state, nonce, verifier);
  const response = Response.redirect(oidcAuthorizeUrl({
    issuer: env.OIDC_ISSUER,
    clientId: env.OIDC_CLIENT_ID,
    redirectUri: env.OIDC_REDIRECT_URI,
    state,
    nonce,
    codeChallenge: challenge,
    scope: env.OIDC_SCOPES
  }));
  response.headers.append("Set-Cookie", `${TX_COOKIE}=${transaction}; HttpOnly; Path=/; SameSite=Lax; Max-Age=300${new URL(env.APP_BASE_URL).protocol === "https:" ? "; Secure" : ""}`);
  return response;
}

export { TX_COOKIE };
