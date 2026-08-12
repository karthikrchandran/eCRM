import { createHash, timingSafeEqual } from "node:crypto";

type PlatformAuthEnvironment = {
  APP_MODE?: string;
  PLATFORM_ADMIN_TOKEN?: string;
  PLATFORM_ADMIN_ACTOR?: string;
};

type ConstantTimeCompare = (left: Uint8Array, right: Uint8Array) => boolean;

export type PlatformAdministrator = { actor: string };

function digest(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

export function authorizePlatformAdmin(
  request: Request,
  environment: PlatformAuthEnvironment = process.env as PlatformAuthEnvironment,
  compare: ConstantTimeCompare = timingSafeEqual
): PlatformAdministrator | Response {
  if (environment.APP_MODE !== "platform") {
    return Response.json({ error: "Not found." }, { status: 404 });
  }

  const configuredToken = environment.PLATFORM_ADMIN_TOKEN?.trim() ?? "";
  const authorization = request.headers.get("authorization") ?? "";
  const candidate = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  const matches = compare(digest(candidate), digest(configuredToken));
  const actor = environment.PLATFORM_ADMIN_ACTOR?.trim() ?? "";

  if (configuredToken.length < 32 || !matches || !actor) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  return { actor };
}
