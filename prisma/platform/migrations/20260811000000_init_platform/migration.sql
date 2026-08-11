-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "CustomerCellLifecycleStatus" AS ENUM ('PROVISIONING', 'ACTIVE', 'PROVISIONING_FAILED', 'SUSPENDED', 'OFFBOARDING', 'DELETED');

-- CreateEnum
CREATE TYPE "ProvisioningResult" AS ENUM ('IN_PROGRESS', 'SUCCEEDED', 'FAILED');

-- CreateTable
CREATE TABLE "CustomerCell" (
    "id" TEXT NOT NULL,
    "cellKey" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "desiredSubdomain" TEXT NOT NULL,
    "lifecycleStatus" "CustomerCellLifecycleStatus" NOT NULL DEFAULT 'PROVISIONING',
    "databaseReference" TEXT,
    "storageReference" TEXT,
    "secretReference" TEXT,
    "backupReference" TEXT,
    "applicationReference" TEXT,
    "applicationUrl" TEXT,
    "signalLoopWorkspaceReference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerCell_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstallationConnection" (
    "id" TEXT NOT NULL,
    "cellId" TEXT NOT NULL,
    "connectionKey" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "workspaceReference" TEXT,
    "secretReference" TEXT NOT NULL,
    "capabilities" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstallationConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProvisioningAttempt" (
    "id" TEXT NOT NULL,
    "cellId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "result" "ProvisioningResult" NOT NULL DEFAULT 'IN_PROGRESS',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProvisioningAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProvisioningAction" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "step" TEXT NOT NULL,
    "result" "ProvisioningResult" NOT NULL,
    "reference" TEXT,
    "errorCode" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProvisioningAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ControlPlaneAuditEvent" (
    "id" TEXT NOT NULL,
    "cellId" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "result" "ProvisioningResult" NOT NULL,
    "correlationId" TEXT NOT NULL,
    "reason" TEXT,
    "secretReference" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ControlPlaneAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportGrant" (
    "id" TEXT NOT NULL,
    "cellId" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "caseReference" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportGrant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomerCell_cellKey_key" ON "CustomerCell"("cellKey");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerCell_desiredSubdomain_key" ON "CustomerCell"("desiredSubdomain");

-- CreateIndex
CREATE INDEX "InstallationConnection_cellId_status_idx" ON "InstallationConnection"("cellId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "InstallationConnection_cellId_connectionKey_key" ON "InstallationConnection"("cellId", "connectionKey");

-- CreateIndex
CREATE INDEX "ProvisioningAttempt_correlationId_idx" ON "ProvisioningAttempt"("correlationId");

-- CreateIndex
CREATE UNIQUE INDEX "ProvisioningAttempt_cellId_idempotencyKey_key" ON "ProvisioningAttempt"("cellId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "ProvisioningAction_attemptId_occurredAt_idx" ON "ProvisioningAction"("attemptId", "occurredAt");

-- CreateIndex
CREATE INDEX "ControlPlaneAuditEvent_cellId_occurredAt_idx" ON "ControlPlaneAuditEvent"("cellId", "occurredAt");

-- CreateIndex
CREATE INDEX "ControlPlaneAuditEvent_correlationId_idx" ON "ControlPlaneAuditEvent"("correlationId");

-- CreateIndex
CREATE INDEX "SupportGrant_cellId_expiresAt_idx" ON "SupportGrant"("cellId", "expiresAt");

-- AddForeignKey
ALTER TABLE "InstallationConnection" ADD CONSTRAINT "InstallationConnection_cellId_fkey" FOREIGN KEY ("cellId") REFERENCES "CustomerCell"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProvisioningAttempt" ADD CONSTRAINT "ProvisioningAttempt_cellId_fkey" FOREIGN KEY ("cellId") REFERENCES "CustomerCell"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProvisioningAction" ADD CONSTRAINT "ProvisioningAction_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "ProvisioningAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ControlPlaneAuditEvent" ADD CONSTRAINT "ControlPlaneAuditEvent_cellId_fkey" FOREIGN KEY ("cellId") REFERENCES "CustomerCell"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportGrant" ADD CONSTRAINT "SupportGrant_cellId_fkey" FOREIGN KEY ("cellId") REFERENCES "CustomerCell"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
