-- AlterTable
ALTER TABLE "audit_runs" ADD COLUMN     "ttfb" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "weekly_intelligence_snapshots" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "project_url_id" TEXT NOT NULL,
    "latest_run_id" TEXT NOT NULL,
    "previous_run_id" TEXT NOT NULL,
    "metrics_json" JSONB NOT NULL,
    "regressions_json" JSONB NOT NULL,
    "improvements_json" JSONB NOT NULL,
    "ai_insight" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "weekly_intelligence_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "weekly_intelligence_snapshots_project_url_id_latest_run_id__key" ON "weekly_intelligence_snapshots"("project_url_id", "latest_run_id", "previous_run_id");

-- AddForeignKey
ALTER TABLE "weekly_intelligence_snapshots" ADD CONSTRAINT "weekly_intelligence_snapshots_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_intelligence_snapshots" ADD CONSTRAINT "weekly_intelligence_snapshots_project_url_id_fkey" FOREIGN KEY ("project_url_id") REFERENCES "project_urls"("id") ON DELETE CASCADE ON UPDATE CASCADE;
