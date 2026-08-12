import { db } from "@/server/db";
import { getServerEnv } from "@/server/env";
import {
  CellControlProjectionService,
  type CellControlProjectionEnvelope
} from "@/server/cell-control/projection";
import { PrismaCellControlProjectionRepository } from "@/server/cell-control/repository";

type Dependencies = {
  apply(envelope: CellControlProjectionEnvelope, signature: string): Promise<{
    applied: boolean; duplicate: boolean; version: number;
  }>;
};

export function createControlProjectionHandler(dependencies: Dependencies) {
  return async function POST(request: Request) {
    const signature = request.headers.get("x-cell-control-signature");
    if (!signature) return Response.json({ error: "Unauthorized." }, { status: 401 });
    try {
      const envelope = await request.json() as CellControlProjectionEnvelope;
      const result = await dependencies.apply(envelope, signature);
      return Response.json({ acknowledged: true, ...result });
    } catch {
      return Response.json({ error: "Control projection rejected." }, { status: 409 });
    }
  };
}

async function applyProjection(envelope: CellControlProjectionEnvelope, signature: string) {
  const runtime = getServerEnv().runtime;
  if (runtime.mode !== "cell") throw new Error("Control projections are accepted only by customer cells");
  return new CellControlProjectionService({
    cellId: runtime.cellId,
    secret: process.env.CELL_CONTROL_PROJECTION_SECRET ?? "",
    repository: new PrismaCellControlProjectionRepository(db)
  }).apply(envelope, signature);
}

export const POST = createControlProjectionHandler({ apply: applyProjection });
