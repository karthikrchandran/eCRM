import { SignJWT, jwtVerify } from "jose";
import { z } from "zod";
import { getServerEnv } from "@/server/env";

export const SESSION_COOKIE_NAME = "ecrm_session";

const sessionUserSchema = z.object({
  id: z.string().min(1),
  email: z.string().email(),
  name: z.string().min(1),
  role: z.enum(["ADMIN", "SALES"])
});

export type SessionUser = z.infer<typeof sessionUserSchema>;

function encodeSecret(secret: string) {
  return new TextEncoder().encode(secret);
}

export async function signSession(user: SessionUser, secret = getServerEnv().AUTH_SECRET) {
  const sessionUser = sessionUserSchema.parse(user);

  return new SignJWT(sessionUser)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(encodeSecret(secret));
}

export async function verifySessionToken(token: string, secret = getServerEnv().AUTH_SECRET) {
  try {
    const { payload } = await jwtVerify(token, encodeSecret(secret), {
      algorithms: ["HS256"],
      requiredClaims: ["exp", "iat"]
    });
    return sessionUserSchema.parse(payload);
  } catch {
    return null;
  }
}
