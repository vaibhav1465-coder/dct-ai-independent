ALTER TABLE "CheckMetadata"
ADD COLUMN "aiDetectionScore" DOUBLE PRECISION,
ADD COLUMN "aiDetectionPassed" BOOLEAN,
ADD COLUMN "aiDetectionProvider" TEXT,
ADD COLUMN "aiDetectionModel" TEXT;

CREATE INDEX "CheckMetadata_aiDetectionPassed_createdAt_idx"
ON "CheckMetadata"("aiDetectionPassed", "createdAt");
