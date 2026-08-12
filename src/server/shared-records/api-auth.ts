import { isConfiguredCellRuntimeActive } from "@/server/runtime/cell-config";

export function requireSharedDataApiToken(request: Request): Response | null {
  if (!isConfiguredCellRuntimeActive()) return Response.json({ error: "Customer cell is not active." }, { status: 423 });
  const configuredToken = process.env.SHARED_DATA_API_TOKEN;

  if (!configuredToken) {
    return Response.json({ error: "Shared data API token is not configured." }, { status: 500 });
  }

  const authorization = request.headers.get("authorization");
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];

  if (token !== configuredToken) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  return null;
}
