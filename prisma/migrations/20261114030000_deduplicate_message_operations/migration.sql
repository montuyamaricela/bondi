ALTER TABLE "Message" ADD COLUMN "clientRequestId" TEXT;

-- Legacy rows keep NULL; only identified operations are deduplicated.
CREATE UNIQUE INDEX "Message_senderId_matchId_clientRequestId_key"
ON "Message"("senderId", "matchId", "clientRequestId");
