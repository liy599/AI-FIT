-- AlterTable
ALTER TABLE "UserSettings" ADD COLUMN "cameraZoom" REAL NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "UserSettings" ADD COLUMN "cameraViewportWidth" INTEGER NOT NULL DEFAULT 420;
