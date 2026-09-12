ALTER TABLE "CellConfiguration"
  ADD COLUMN "supportUrl" TEXT,
  ADD COLUMN "legalUrl" TEXT,
  ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 0;
