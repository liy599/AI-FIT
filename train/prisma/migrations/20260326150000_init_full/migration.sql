-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "UserSettings" (
    "userId" TEXT NOT NULL PRIMARY KEY,
    "saveOriginalVideos" BOOLEAN NOT NULL DEFAULT false,
    "videoTtlDays" INTEGER,
    "cameraMirror" BOOLEAN NOT NULL DEFAULT true,
    "cameraZoom" REAL NOT NULL DEFAULT 1,
    "cameraViewportWidth" INTEGER NOT NULL DEFAULT 420,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "revokedAt" DATETIME,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Exercise" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "isBuiltin" BOOLEAN NOT NULL DEFAULT false,
    "movementType" TEXT NOT NULL DEFAULT 'strength',
    "categoryId" TEXT,
    "userId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Exercise_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ExerciseCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Exercise_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExerciseCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "isBuiltin" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "userId" TEXT,
    "parentId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ExerciseCategory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ExerciseCategory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ExerciseCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TrainingSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" DATETIME,
    "note" TEXT,
    "report" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TrainingSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TrainingSet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trainingId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "reps" INTEGER NOT NULL,
    "weight" REAL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TrainingSet_trainingId_fkey" FOREIGN KEY ("trainingId") REFERENCES "TrainingSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TrainingSet_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VideoAsset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storagePath" TEXT NOT NULL,
    "keepOriginal" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VideoAsset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AnalysisTask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "videoAssetId" TEXT,
    "exerciseId" TEXT,
    "viewAngle" TEXT NOT NULL DEFAULT 'unknown',
    "instruction" TEXT,
    "startedAt" DATETIME,
    "finishedAt" DATETIME,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AnalysisTask_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AnalysisTask_videoAssetId_fkey" FOREIGN KEY ("videoAssetId") REFERENCES "VideoAsset" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AnalysisTask_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AnalysisResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskId" TEXT NOT NULL,
    "report" JSON NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AnalysisResult_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "AnalysisTask" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_createdAt_idx" ON "Session"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE INDEX "Exercise_categoryId_idx" ON "Exercise"("categoryId");

-- CreateIndex
CREATE INDEX "Exercise_userId_idx" ON "Exercise"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Exercise_userId_categoryId_name_key" ON "Exercise"("userId", "categoryId", "name");

-- CreateIndex
CREATE INDEX "ExerciseCategory_userId_parentId_sortOrder_idx" ON "ExerciseCategory"("userId", "parentId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ExerciseCategory_userId_parentId_name_key" ON "ExerciseCategory"("userId", "parentId", "name");

-- CreateIndex
CREATE INDEX "TrainingSession_userId_startedAt_idx" ON "TrainingSession"("userId", "startedAt");

-- CreateIndex
CREATE INDEX "TrainingSet_trainingId_order_idx" ON "TrainingSet"("trainingId", "order");

-- CreateIndex
CREATE INDEX "TrainingSet_exerciseId_idx" ON "TrainingSet"("exerciseId");

-- CreateIndex
CREATE INDEX "VideoAsset_userId_createdAt_idx" ON "VideoAsset"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "VideoAsset_expiresAt_idx" ON "VideoAsset"("expiresAt");

-- CreateIndex
CREATE INDEX "AnalysisTask_userId_createdAt_idx" ON "AnalysisTask"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AnalysisTask_status_updatedAt_idx" ON "AnalysisTask"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "AnalysisTask_videoAssetId_idx" ON "AnalysisTask"("videoAssetId");

-- CreateIndex
CREATE INDEX "AnalysisTask_exerciseId_idx" ON "AnalysisTask"("exerciseId");

-- CreateIndex
CREATE INDEX "AnalysisResult_taskId_createdAt_idx" ON "AnalysisResult"("taskId", "createdAt");
