ALTER TABLE public."MessageDelivery"
  ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC');
CREATE INDEX "MessageDelivery_completedAt_nextAttemptAt_createdAt_idx"
  ON public."MessageDelivery" ("completedAt", "nextAttemptAt", "createdAt");

DO $migration$
BEGIN
  IF to_regclass('realtime.messages') IS NOT NULL THEN
    CREATE EXTENSION IF NOT EXISTS pg_cron;

    EXECUTE $function$
      CREATE FUNCTION bondi_private.dispatch_message_hints(target_message_id TEXT DEFAULT NULL)
      RETURNS INTEGER LANGUAGE plpgsql
      SET search_path = pg_catalog AS $body$
      DECLARE
        delivery RECORD;
        membership RECORD;
        audience RECORD;
        hint_id UUID;
        processed INTEGER := 0;
      BEGIN
        FOR delivery IN
          SELECT d."messageId", d."userId" FROM public."MessageDelivery" d
          WHERE d."completedAt" IS NULL
            AND d."nextAttemptAt" <= (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
            AND (target_message_id IS NULL OR d."messageId" = target_message_id)
          ORDER BY d."nextAttemptAt", d."createdAt", d."messageId", d."userId"
          LIMIT 100 FOR UPDATE SKIP LOCKED
        LOOP
          BEGIN
            SELECT m."senderId", mt."status", mt."user1Id", mt."user2Id"
              INTO membership FROM public."Message" m
              JOIN public."Match" mt ON mt.id = m."matchId"
              WHERE m.id = delivery."messageId" FOR SHARE OF mt;
            IF FOUND AND membership."status" = 'ACTIVE'
              AND delivery."userId" IN (membership."user1Id", membership."user2Id")
              AND membership."senderId" IN (membership."user1Id", membership."user2Id")
            THEN
              FOR audience IN
                SELECT l.topic FROM public."RealtimeLease" l
                JOIN public."Session" s ON s.id = l."sessionId" AND s."userId" = l."userId"
                WHERE l."userId" = delivery."userId"
                  AND l."expiresAt" > (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
                  AND s."expiresAt" > (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
              LOOP
                hint_id := gen_random_uuid();
                PERFORM realtime.send(jsonb_build_object('id', hint_id), 'changed', audience.topic, true);
                -- realtime.send warns rather than raising on insert failure.
                IF NOT EXISTS (
                  SELECT 1 FROM realtime.messages r
                  WHERE r.topic = audience.topic AND r.event = 'changed'
                    AND r.payload->>'id' = hint_id::text
                ) THEN RAISE EXCEPTION 'Native invalidation was not enqueued'; END IF;
              END LOOP;
            END IF;
            UPDATE public."MessageDelivery" SET
              "completedAt" = (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'), "attempts" = "attempts" + 1
              WHERE "messageId" = delivery."messageId" AND "userId" = delivery."userId";
          EXCEPTION WHEN OTHERS THEN
            -- The native enqueue rolled back with this subtransaction. Persist retry work.
            UPDATE public."MessageDelivery" SET
              "nextAttemptAt" = (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
                + make_interval(secs => least(60, power(2, least("attempts", 6)))::double precision),
              "attempts" = "attempts" + 1
              WHERE "messageId" = delivery."messageId" AND "userId" = delivery."userId";
          END;
          processed := processed + 1;
        END LOOP;
        RETURN processed;
      END;
      $body$;
    $function$;
    REVOKE ALL ON FUNCTION bondi_private.dispatch_message_hints(TEXT) FROM PUBLIC, anon, authenticated;
    PERFORM cron.schedule('bondi-message-delivery', '1 second', 'SELECT bondi_private.dispatch_message_hints()');
  END IF;
END;
$migration$;
