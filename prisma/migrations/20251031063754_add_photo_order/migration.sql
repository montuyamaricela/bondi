-- AlterTable
ALTER TABLE "File" ADD COLUMN     "order" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "File_userId_order_idx" ON "File"("userId", "order");
