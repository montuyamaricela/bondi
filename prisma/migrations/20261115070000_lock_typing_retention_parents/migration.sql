DO $migration$
BEGIN
  IF to_regclass('realtime.messages') IS NOT NULL THEN
    EXECUTE $function$
      CREATE OR REPLACE FUNCTION bondi_private.prune_typing_leases() RETURNS VOID LANGUAGE sql
      SET search_path = pg_catalog AS $body$
        WITH expired AS (
          SELECT t."leaseId", t."matchId", t."viewId" FROM public."TypingLease" t
          JOIN public."RealtimeLease" l ON l.id = t."leaseId"
          JOIN public."Session" s ON s.id = l."sessionId"
          WHERE l."expiresAt" <= (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
             OR s."expiresAt" <= (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
          LIMIT 1000 FOR UPDATE OF t, l, s SKIP LOCKED
        )
        DELETE FROM public."TypingLease" t USING expired e
        WHERE t."leaseId" = e."leaseId" AND t."matchId" = e."matchId" AND t."viewId" = e."viewId";
      $body$;
    $function$;
    REVOKE ALL ON FUNCTION bondi_private.prune_typing_leases() FROM PUBLIC, anon, authenticated;
  END IF;
END;
$migration$;
