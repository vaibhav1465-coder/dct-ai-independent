ALTER TABLE "CheckMetadata" ADD COLUMN "aiHeadlineScore" DOUBLE PRECISION;
ALTER TABLE "CheckMetadata" ADD COLUMN "aiBodyScore" DOUBLE PRECISION;
ALTER TABLE "CheckMetadata" ADD COLUMN "aiDetectionThreshold" DOUBLE PRECISION;
ALTER TABLE "CheckMetadata" ADD COLUMN "cviVerdict" TEXT;
ALTER TABLE "CheckMetadata" ADD COLUMN "cviAction" TEXT;
