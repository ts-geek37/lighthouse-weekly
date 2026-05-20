-- AlterTable
ALTER TABLE "audit_runs" ADD COLUMN     "html_report" TEXT,
ADD COLUMN     "raw_json" JSONB;
