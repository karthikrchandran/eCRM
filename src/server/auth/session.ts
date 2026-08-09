import { SignJWT, jwtVerify } from "jose";
import { z } from "zod";
import { getServerEnv } from "@/server/env";

export const SESSION_COOKIE_NAME = "ecrm_session";

const SESSION_ISSUER = "ecrm";
const SESSION_AUDIENCE = "ecrm-session";
const SESSION_MAX_TOKEN_AGE = "8h";

const sessionUserSchema = z.object({
  id: z.string().trim().min(1),
  email: z.string().trim().email(),
  name: z.string().trim().min(1),
  organizationId: z.string().trim().min(1),
  membershipId: z.string().trim().min(1),
  role: z.enum(["OWNER", "ADMIN", "SALES", "FINANCE", "PRODUCTION", "READ_ONLY"]),
  sessionVersion: z.number().int().positive()
}).strict();

const sessionTokenPayloadSchema = sessionUserSchema
  .extend({
    iss: z.literal(SESSION_ISSUER),
    aud: z.literal(SESSION_AUDIENCE),
    iat: z.number().int(),
    exp: z.number().int()
  })
  .strict()
  .transform(({ id, email, name, organizationId, membershipId, role, sessionVersion }) => ({
    id,
    email,
    name,
    organizationId,
    membershipId,
    role,
    sessionVersion
  }));

export type SessionUser = z.infer<typeof sessionUserSchema>;

export function membershipSessionVersion(updatedAt: Date) {
  return updatedAt.getTime();
}

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
    return sessionTokenPayloadSchema.parse(payload);
  } catch {
    return null;
  }
}
