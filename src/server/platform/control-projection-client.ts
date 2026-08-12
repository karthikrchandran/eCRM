import type { PrismaClient } from "../../generated/platform-client";

import type { CellControlProjectionEnvelope } from "@/server/cell-control/projection";
import type { CellControlProjectionClient } from "./administration";

export class HttpCellControlProjectionClient implements CellControlProjectionClient {
  public constructor(
    private readonly database: PrismaClient,
    private readonly fetcher: typeof fetch = fetch
  ) {}

  public async deliver(envelope: CellControlProjectionEnvelope, signature: string) {
    const cell = await this.database.customerCell.findUnique({
      where: { id: envelope.cellId }, select: { applicationUrl: true }
    });
    if (!cell?.applicationUrl) throw new Error("Customer cell application URL is not configured");
    const response = await this.fetcher(new URL("/api/internal/control-projections", cell.applicationUrl), {
      method: "POST",
      headers: { "content-type": "application/json", "x-cell-control-signature": signature },
      body: JSON.stringify(envelope)
    });
    if (!response.ok) throw new Error(`Customer cell rejected control projection (${response.status})`);
    const acknowledgement = await response.json() as { acknowledged?: boolean; version?: number };
    if (acknowledgement.acknowledged !== true || acknowledgement.version !== envelope.version) {
      throw new Error("Customer cell returned an invalid control projection acknowledgement");
    }
    return { acknowledged: true as const, version: acknowledgement.version };
  }
}
