import { getControlPlaneDb } from "@/server/db";
import {
  InstallationProjectionError,
  verifyInstallationProjection
} from "@/server/integrations/installation-projection";

export async function POST(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const installationId = request.headers.get("x-installation-id")?.trim();
  if (!token || !installationId) return Response.json({ error: "Unauthorized." }, { status: 401 });

  try {
    const db = getControlPlaneDb();
    const installation = await db.organizationInstallation.findUnique({ where: { installationId } });
    if (!installation || installation.status !== "ACTIVE") return Response.json({ error: "Installation is not active." }, { status: 403 });

    const claims = await verifyInstallationProjection(token, installation.publicKey, {
      tenantKey: installation.tenantKey,
      keyVersion: installation.keyVersion,
      minProjectionVersion: installation.lastAppliedVersion
    });
    const result = await db.$transaction(async (tx) => {
      const replay = await tx.integrationReplayReceipt.findUnique({
        where: { installationId_jti: { installationId, jti: claims.jti } }
      });
      if (replay) return { applied: false, projectionVersion: installation.lastAppliedVersion };
      await tx.organizationInstallation.update({
        where: { installationId },
        data: { lastAppliedVersion: claims.projectionVersion }
      });
      await tx.integrationReplayReceipt.create({
        data: {
          installationId,
          jti: claims.jti,
          projectionVersion: claims.projectionVersion,
          expiresAt: new Date(Date.now() + 120_000)
        }
      });
      return { applied: true, projectionVersion: claims.projectionVersion };
    });
    return Response.json(result);
  } catch (error) {
    if (error instanceof InstallationProjectionError) return Response.json({ error: error.message }, { status: 403 });
    return Response.json({ error: "Unable to apply installation projection." }, { status: 500 });
  }
}
