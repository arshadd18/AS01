/*
  Warnings:

  - A unique constraint covering the columns `[billId,userId]` on the table `BillSplit` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[conversationId]` on the table `Group` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `conversationId` to the `Group` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "GroupRole" AS ENUM ('OWNER', 'MEMBER');

-- AlterTable
ALTER TABLE "Group" ADD COLUMN     "conversationId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "GroupMember" ADD COLUMN     "role" "GroupRole" NOT NULL DEFAULT 'MEMBER';

-- CreateIndex
CREATE UNIQUE INDEX "BillSplit_billId_userId_key" ON "BillSplit"("billId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Group_conversationId_key" ON "Group"("conversationId");

-- AddForeignKey
ALTER TABLE "Group" ADD CONSTRAINT "Group_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
