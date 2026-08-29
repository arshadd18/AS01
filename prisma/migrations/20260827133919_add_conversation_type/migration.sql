/*
  Warnings:

  - A unique constraint covering the columns `[directUser1Id,directUser2Id]` on the table `Conversation` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `type` to the `Conversation` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ConversationType" AS ENUM ('DIRECT', 'GROUP');

-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "directUser1Id" INTEGER,
ADD COLUMN     "directUser2Id" INTEGER,
ADD COLUMN     "type" "ConversationType" NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_directUser1Id_directUser2Id_key" ON "Conversation"("directUser1Id", "directUser2Id");
