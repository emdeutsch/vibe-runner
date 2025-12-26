-- CreateTable
CREATE TABLE "public"."session_commit_files" (
    "id" TEXT NOT NULL,
    "commit_id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "additions" INTEGER,
    "deletions" INTEGER,

    CONSTRAINT "session_commit_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."session_pull_requests" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "repo_owner" TEXT NOT NULL,
    "repo_name" TEXT NOT NULL,
    "pr_number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "html_url" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,
    "merged_at" TIMESTAMP(3),
    "additions" INTEGER,
    "deletions" INTEGER,

    CONSTRAINT "session_pull_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "session_commit_files_commit_id_idx" ON "public"."session_commit_files"("commit_id");

-- CreateIndex
CREATE INDEX "session_pull_requests_session_id_idx" ON "public"."session_pull_requests"("session_id");

-- CreateIndex
CREATE UNIQUE INDEX "session_pull_requests_session_id_pr_number_repo_owner_repo__key" ON "public"."session_pull_requests"("session_id", "pr_number", "repo_owner", "repo_name");

-- AddForeignKey
ALTER TABLE "public"."session_commit_files" ADD CONSTRAINT "session_commit_files_commit_id_fkey" FOREIGN KEY ("commit_id") REFERENCES "public"."session_commits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."session_pull_requests" ADD CONSTRAINT "session_pull_requests_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."workout_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
