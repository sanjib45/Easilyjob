-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Job" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "category" TEXT NOT NULL,
    "designation" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "salary" TEXT NOT NULL,
    "openings" INTEGER NOT NULL,
    "skills" TEXT NOT NULL,
    "applyBy" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "closedAt" DATETIME,
    "publishedAt" DATETIME,
    "applicationsAccepted" INTEGER NOT NULL DEFAULT 0,
    "recruiterId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Job_recruiterId_fkey" FOREIGN KEY ("recruiterId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Job" ("applyBy", "category", "companyName", "createdAt", "designation", "id", "location", "openings", "recruiterId", "salary", "skills", "updatedAt") SELECT "applyBy", "category", "companyName", "createdAt", "designation", "id", "location", "openings", "recruiterId", "salary", "skills", "updatedAt" FROM "Job";
DROP TABLE "Job";
ALTER TABLE "new_Job" RENAME TO "Job";
CREATE INDEX "Job_recruiterId_idx" ON "Job"("recruiterId");
CREATE INDEX "Job_location_idx" ON "Job"("location");
CREATE INDEX "Job_category_idx" ON "Job"("category");
CREATE INDEX "Job_applyBy_idx" ON "Job"("applyBy");
CREATE INDEX "Job_status_applyBy_createdAt_idx" ON "Job"("status", "applyBy", "createdAt");
CREATE INDEX "Job_recruiterId_status_createdAt_idx" ON "Job"("recruiterId", "status", "createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Application_jobId_createdAt_idx" ON "Application"("jobId", "createdAt");

-- CreateIndex
CREATE INDEX "Application_applicantId_createdAt_idx" ON "Application"("applicantId", "createdAt");
