-- CreateEnum
CREATE TYPE "Environment" AS ENUM ('Production', 'Staging');

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "owner" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "environment" "Environment" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_urls" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "page_type" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_urls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_runs" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "project_url_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'success',
    "performance_score" DOUBLE PRECISION,
    "accessibility_score" DOUBLE PRECISION,
    "seo_score" DOUBLE PRECISION,
    "best_practices_score" DOUBLE PRECISION,
    "lcp" DOUBLE PRECISION,
    "cls" DOUBLE PRECISION,
    "inp_or_tbt" DOUBLE PRECISION,
    "fcp" DOUBLE PRECISION,
    "speed_index" DOUBLE PRECISION,
    "opportunities_json" JSONB,
    "ai_summary" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_runs_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "project_urls" ADD CONSTRAINT "project_urls_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_runs" ADD CONSTRAINT "audit_runs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_runs" ADD CONSTRAINT "audit_runs_project_url_id_fkey" FOREIGN KEY ("project_url_id") REFERENCES "project_urls"("id") ON DELETE CASCADE ON UPDATE CASCADE;
