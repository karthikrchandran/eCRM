import type { DestinationProvider, ProjectionStream } from "./outbox";

export class HttpDestinationProvider implements DestinationProvider {
  public constructor(
    private readonly baseUrl: string,
    private readonly token: string,
    private readonly cell: { cellId: string; cellKey: string },
    private readonly fetcher: typeof fetch = fetch
  ) {}

  public async deliver(destinationInstallation: string, message: { eventType: string; payloadVersion: number; payload: Record<string, unknown>; correlationId: string; idempotencyKey: string }, signal?: AbortSignal) {
    const eventKind = eventKindFor(message.eventType);
    const streamKey = streamKeyFor(message.idempotencyKey, message.payloadVersion);
    const response = await this.request<{
      receipt_id: string;
      workspace_id: string;
      source_event_id: string;
      source_version: number;
      status: string;
    }>("/api/v1/ecrm-installations/deliveries", {
      source_event_id: message.idempotencyKey,
      source_version: message.payloadVersion,
      stream_key: streamKey,
      event_kind: eventKind,
      payload: message.payload
    }, signal, {
      "idempotency-key": message.idempotencyKey,
      "x-correlation-id": message.correlationId,
      "x-ecrm-cell-id": this.cell.cellId,
      "x-ecrm-cell-key": this.cell.cellKey,
      "x-workspace-id": destinationInstallation
    });
    if (
      !response.receipt_id
      || response.workspace_id !== destinationInstallation
      || response.source_event_id !== message.idempotencyKey
      || response.source_version !== message.payloadVersion
      || !["RECEIVED", "RETRY_SCHEDULED", "HELD_GAP", "IN_FLIGHT", "APPLIED"].includes(response.status)
    ) {
      throw Object.assign(new Error("Destination acknowledgement did not match the delivery"), { code: "INVALID_ACK" });
    }
    return { acknowledgementId: response.receipt_id };
  }

  public async reconcileIdempotency(destinationInstallation: string, idempotencyKey: string, signal?: AbortSignal) {
    void destinationInstallation;
    void idempotencyKey;
    void signal;
    // SignalLoop acknowledges an identical replay through the delivery route. The
    // worker therefore falls through to deliver the retained outbox envelope.
    return undefined;
  }

  public checkpoint(destinationInstallation: string, stream: ProjectionStream): Promise<{ count: number; version: number; checkpoint: string | null }> {
    void destinationInstallation;
    void stream;
    return Promise.reject(Object.assign(
      new Error("SignalLoop checkpoint reconciliation requires its workspace-admin API"),
      { code: "CHECKPOINT_CONTRACT_UNAVAILABLE" }
    ));
  }

  private async request<T>(path: string, body: Record<string, unknown>, signal?: AbortSignal, headers: Record<string, string> = {}): Promise<T> {
    const response = await this.fetcher(`${this.baseUrl}${path}`, {
      method: "POST", headers: { authorization: `Bearer ${this.token}`, "content-type": "application/json", ...headers }, body: JSON.stringify(body), signal
    });
    if (!response.ok) throw Object.assign(new Error("Destination delivery failed"), { code: `REMOTE_${response.status}` });
    return await response.json() as T;
  }
}

export function configuredDestinationProvider(environment: Record<string, string | undefined> = process.env): HttpDestinationProvider {
  const baseUrl = environment.INTEGRATION_DESTINATION_URL;
  const token = environment.INTEGRATION_DESTINATION_TOKEN;
  const cellId = environment.CELL_ID;
  const cellKey = environment.CELL_KEY;
  if (!baseUrl || !token || !cellId || !cellKey || !/^https:\/\//.test(baseUrl)) throw new Error("Integration destination is not configured");
  return new HttpDestinationProvider(baseUrl.replace(/\/$/, ""), token, { cellId, cellKey });
}

function eventKindFor(eventType: string): "SHARED_RECORD" | "WORKFLOW_EVENT" {
  if (eventType.startsWith("shared-record.")) return "SHARED_RECORD";
  if (eventType.startsWith("workflow-event.")) return "WORKFLOW_EVENT";
  throw Object.assign(new Error("Unsupported integration event type"), { code: "UNSUPPORTED_EVENT_TYPE" });
}

function streamKeyFor(idempotencyKey: string, sourceVersion: number): string {
  const suffix = `:${sourceVersion}`;
  return idempotencyKey.endsWith(suffix) ? idempotencyKey.slice(0, -suffix.length) : idempotencyKey;
}
