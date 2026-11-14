-- Stop for a separately reviewed repair plan; never delete or reassign history.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM "Match"
        GROUP BY LEAST("user1Id", "user2Id"), GREATEST("user1Id", "user2Id")
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION 'Duplicate match pairs require a reviewed data-repair plan. No history was changed.';
    END IF;
    IF EXISTS (
        SELECT 1 FROM "Notification"
        WHERE "type" = 'MATCH' AND "entityId" IS NOT NULL
        GROUP BY "userId", "entityId" HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION 'Duplicate match notifications require a reviewed data-repair plan. No history was changed.';
    END IF;
END;
$$;

CREATE UNIQUE INDEX "Match_unordered_pair_key"
ON "Match" ((LEAST("user1Id", "user2Id")), (GREATEST("user1Id", "user2Id")));

CREATE UNIQUE INDEX "Notification_match_recipient_key"
ON "Notification" ("userId", "entityId")
WHERE "type" = 'MATCH' AND "entityId" IS NOT NULL;
