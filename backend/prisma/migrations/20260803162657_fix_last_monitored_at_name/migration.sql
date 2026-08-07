/*
  Warnings:

  - You are about to drop the column `lastMonitoring` on the `Investigation` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Investigation" DROP COLUMN "lastMonitoring",
ADD COLUMN     "lastMonitoredAt" TIMESTAMP(3);
