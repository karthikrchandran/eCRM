-- CreateEnum
CREATE TYPE "SalesTaskStatus" AS ENUM ('OPEN', 'COMPLETED', 'CARRIED_FORWARD', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SalesTaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "SalesTaskType" AS ENUM ('CALL', 'EMAIL', 'FOLLOW_UP', 'SEND_MATERIAL', 'MEETING', 'CRM_UPDATE', 'CUSTOM');

-- CreateEnum
CREATE TYPE "SalesTaskSource" AS ENUM ('MANUAL', 'VOICE_NOTE', 'CARRY_FORWARD', 'INSIGHT', 'CRM');

-- CreateEnum
CREATE TYPE "SalesVoiceNoteStatus" AS ENUM ('UPLOADED', 'TRANSCRIBING', 'TRANSCRIBED', 'FAILED');

-- CreateEnum
CREATE TYPE "SalesSuggestedActionStatus" AS ENUM ('DRAFT', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SalesDayReviewItemStatus" AS ENUM ('DONE', 'MOVE_TO_TOMORROW', 'BLOCKED', 'WAITING_ON_CUSTOMER', 'CANCEL');

-- CreateTable
CREATE TABLE "SalesTask" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "leadCustomerId" TEXT,
    "opportunityId" TEXT,
    "proposalId" TEXT,
    "orderId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "SalesTaskType" NOT NULL,
    "priority" "SalesTaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "SalesTaskStatus" NOT NULL DEFAULT 'OPEN',
    "source" "SalesTaskSource" NOT NULL DEFAULT 'MANUAL',
    "dueAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdFromNoteId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesVoiceNote" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "taskId" TEXT,
    "leadCustomerId" TEXT,
    "opportunityId" TEXT,
    "proposalId" TEXT,
    "orderId" TEXT,
    "audioStorageKey" TEXT NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "durationSeconds" INTEGER,
    "status" "SalesVoiceNoteStatus" NOT NULL DEFAULT 'UPLOADED',
    "transcript" TEXT,
    "summary" TEXT,
    "customerAsk" TEXT,
    "nextStep" TEXT,
    "processingError" TEXT,
    "retainedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesVoiceNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesVoiceNoteAction" (
    "id" TEXT NOT NULL,
    "voiceNoteId" TEXT NOT NULL,
    "createdTaskId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "SalesTaskType" NOT NULL,
    "suggestedDueAt" TIMESTAMP(3),
    "status" "SalesSuggestedActionStatus" NOT NULL DEFAULT 'DRAFT',
    "confidenceLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),

    CONSTRAINT "SalesVoiceNoteAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesDayReview" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "reviewDate" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesDayReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesDayReviewItem" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "status" "SalesDayReviewItemStatus" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalesDayReviewItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SalesTask_ownerId_dueAt_idx" ON "SalesTask"("ownerId", "dueAt");

-- CreateIndex
CREATE INDEX "SalesTask_ownerId_status_idx" ON "SalesTask"("ownerId", "status");

-- CreateIndex
CREATE INDEX "SalesTask_leadCustomerId_idx" ON "SalesTask"("leadCustomerId");

-- CreateIndex
CREATE INDEX "SalesTask_opportunityId_idx" ON "SalesTask"("opportunityId");

-- CreateIndex
CREATE INDEX "SalesTask_proposalId_idx" ON "SalesTask"("proposalId");

-- CreateIndex
CREATE INDEX "SalesTask_orderId_idx" ON "SalesTask"("orderId");

-- CreateIndex
CREATE INDEX "SalesVoiceNote_ownerId_createdAt_idx" ON "SalesVoiceNote"("ownerId", "createdAt");

-- CreateIndex
CREATE INDEX "SalesVoiceNote_taskId_idx" ON "SalesVoiceNote"("taskId");

-- CreateIndex
CREATE INDEX "SalesVoiceNote_leadCustomerId_idx" ON "SalesVoiceNote"("leadCustomerId");

-- CreateIndex
CREATE INDEX "SalesVoiceNote_status_idx" ON "SalesVoiceNote"("status");

-- CreateIndex
CREATE INDEX "SalesVoiceNoteAction_voiceNoteId_idx" ON "SalesVoiceNoteAction"("voiceNoteId");

-- CreateIndex
CREATE INDEX "SalesVoiceNoteAction_status_idx" ON "SalesVoiceNoteAction"("status");

-- CreateIndex
CREATE UNIQUE INDEX "SalesDayReview_ownerId_reviewDate_key" ON "SalesDayReview"("ownerId", "reviewDate");

-- CreateIndex
CREATE INDEX "SalesDayReview_ownerId_reviewDate_idx" ON "SalesDayReview"("ownerId", "reviewDate");

-- CreateIndex
CREATE UNIQUE INDEX "SalesDayReviewItem_reviewId_taskId_key" ON "SalesDayReviewItem"("reviewId", "taskId");

-- CreateIndex
CREATE INDEX "SalesDayReviewItem_taskId_idx" ON "SalesDayReviewItem"("taskId");

-- AddForeignKey
ALTER TABLE "SalesTask" ADD CONSTRAINT "SalesTask_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesTask" ADD CONSTRAINT "SalesTask_leadCustomerId_fkey" FOREIGN KEY ("leadCustomerId") REFERENCES "LeadCustomer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesTask" ADD CONSTRAINT "SalesTask_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesTask" ADD CONSTRAINT "SalesTask_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesTask" ADD CONSTRAINT "SalesTask_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesVoiceNote" ADD CONSTRAINT "SalesVoiceNote_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesVoiceNote" ADD CONSTRAINT "SalesVoiceNote_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "SalesTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesVoiceNote" ADD CONSTRAINT "SalesVoiceNote_leadCustomerId_fkey" FOREIGN KEY ("leadCustomerId") REFERENCES "LeadCustomer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesVoiceNote" ADD CONSTRAINT "SalesVoiceNote_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesVoiceNote" ADD CONSTRAINT "SalesVoiceNote_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesVoiceNote" ADD CONSTRAINT "SalesVoiceNote_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesVoiceNoteAction" ADD CONSTRAINT "SalesVoiceNoteAction_voiceNoteId_fkey" FOREIGN KEY ("voiceNoteId") REFERENCES "SalesVoiceNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesVoiceNoteAction" ADD CONSTRAINT "SalesVoiceNoteAction_createdTaskId_fkey" FOREIGN KEY ("createdTaskId") REFERENCES "SalesTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesDayReview" ADD CONSTRAINT "SalesDayReview_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesDayReviewItem" ADD CONSTRAINT "SalesDayReviewItem_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "SalesDayReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesDayReviewItem" ADD CONSTRAINT "SalesDayReviewItem_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "SalesTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
