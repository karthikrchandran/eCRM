import { SignJWT, jwtVerify } from "jose";
import { z } from "zod";
import { getServerEnv } from "@/server/env";

export const SESSION_COOKIE_NAME = "ecrm_session";

const SESSION_ISSUER = "ecrm";
const SESSION_AUDIENCE = "ecrm-session";
const SESSION_MAX_TOKEN_AGE = "8h";

const sessionUserSchema = z.object({
  id: z.string().min(1),
  email: z.string().email(),
  name: z.string().min(1),
  role: z.enum(["ADMIN", "SALES"])
});

export type SessionUser = z.infer<typeof sessionUserSchema>;

export function shouldUseSecureSessionCookie(appBaseUrl = getServerEnv().APP_BASE_URL) {
  return new URL(appBaseUrl).protocol === "https:";
}

function encodeSecret(secret: string) {
  return new TextEncoder().encode(secret);
}

export async function signSession(user: SessionUser, secret = getServerEnv().AUTH_SECRET) {
  const sessionUser = sessionUserSchema.parse(user);

  return new SignJWT(sessionUser)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(SESSION_ISSUER)
    .setAudience(SESSION_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(SESSION_MAX_TOKEN_AGE)
    .sign(encodeSecret(secret));
}

export async function verifySessionToken(token: string, secret = getServerEnv().AUTH_SECRET) {
  try {
    const { payload } = await jwtVerify(token, encodeSecret(secret), {
      algorithms: ["HS256"],
      issuer: SESSION_ISSUER,
      audience: SESSION_AUDIENCE,
      requiredClaims: ["exp", "iat"],
      maxTokenAge: SESSION_MAX_TOKEN_AGE
    });
    return sessionUserSchema.parse(payload);
  } catch {
    return null;
  }
}
