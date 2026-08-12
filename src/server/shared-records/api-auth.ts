import { isConfiguredCellRuntimeActive } from "@/server/runtime/cell-config";

export async function requireSharedDataApiToken(
  request: Request,
  isCellActive: () => Promise<boolean> = () => isConfiguredCellRuntimeActive()
): Promise<Response | null> {
  if (!await isCellActive()) return Response.json({ error: "Customer cell is not active." }, { status: 423 });
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
