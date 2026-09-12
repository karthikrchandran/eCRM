-- Fence provisioning writes so a worker that lost its lease cannot mutate state.
ALTER TABLE "ProvisioningAttempt"
ADD COLUMN "leaseVersion" INTEGER NOT NULL DEFAULT 1;

CREATE UNIQUE INDEX "ProvisioningAttempt_id_leaseVersion_key"
ON "ProvisioningAttempt"("id", "leaseVersion");
