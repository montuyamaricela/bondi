CREATE TABLE "MessageDelivery" (
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "notificationId" TEXT,
    "excludedSocketId" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MessageDelivery_pkey" PRIMARY KEY ("messageId", "userId")
);

CREATE INDEX "MessageDelivery_userId_completedAt_createdAt_idx" ON "MessageDelivery"("userId", "completedAt", "createdAt");
CREATE INDEX "MessageDelivery_notificationId_idx" ON "MessageDelivery"("notificationId");

ALTER TABLE "MessageDelivery" ADD CONSTRAINT "MessageDelivery_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MessageDelivery" ADD CONSTRAINT "MessageDelivery_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MessageDelivery" ADD CONSTRAINT "MessageDelivery_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE SET NULL ON UPDATE CASCADE;
