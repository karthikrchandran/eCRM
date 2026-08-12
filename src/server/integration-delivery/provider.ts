import type { DestinationProvider, ProjectionStream } from "./outbox";

export class HttpDestinationProvider implements DestinationProvider {
  public constructor(private readonly baseUrl: string, private readonly token: string, private readonly fetcher: typeof fetch = fetch) {}

  public async deliver(destinationInstallation: string, message: { eventType: string; payloadVersion: number; payload: Record<string, unknown>; correlationId: string; idempotencyKey: string }, signal?: AbortSignal) {
    return this.request<{ acknowledgementId: string; checkpoint?: string }>("/api/v1/installations/events", { destinationInstallation, ...message }, signal);
  }

  public async reconcileIdempotency(destinationInstallation: string, idempotencyKey: string, signal?: AbortSignal) {
    const response = await this.fetcher(`${this.baseUrl}/api/v1/installations/acknowledgements/${encodeURIComponent(idempotencyKey)}`, {
      headers: { authorization: `Bearer ${this.token}`, "x-destination-installation": destinationInstallation }, signal
    });
    if (response.status === 404) return undefined;
    if (!response.ok) throw Object.assign(new Error("Destination acknowledgement reconciliation failed"), { code: `REMOTE_${response.status}` });
    return await response.json() as { acknowledgementId: string; checkpoint?: string };
  }

  public checkpoint(destinationInstallation: string, stream: ProjectionStream): Promise<{ count: number; version: number; checkpoint: string | null }> {
    return this.request<{ count: number; version: number; checkpoint: string | null }>("/api/v1/installations/checkpoint", { destinationInstallation, stream });
  }

  private async request<T>(path: string, body: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
    const response = await this.fetcher(`${this.baseUrl}${path}`, {
      method: "POST", headers: { authorization: `Bearer ${this.token}`, "content-type": "application/json" }, body: JSON.stringify(body), signal
    });
    if (!response.ok) throw Object.assign(new Error("Destination delivery failed"), { code: `REMOTE_${response.status}` });
    return await response.json() as T;
  }
}

export function configuredDestinationProvider(environment: Record<string, string | undefined> = process.env): HttpDestinationProvider {
  const baseUrl = environment.INTEGRATION_DESTINATION_URL;
  const token = environment.INTEGRATION_DESTINATION_TOKEN;
  if (!baseUrl || !token || !/^https:\/\//.test(baseUrl)) throw new Error("Integration destination is not configured");
  return new HttpDestinationProvider(baseUrl.replace(/\/$/, ""), token);
}
