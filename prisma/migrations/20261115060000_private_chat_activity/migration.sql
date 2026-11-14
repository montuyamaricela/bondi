CREATE TABLE public."TypingLease" (
  "leaseId" TEXT NOT NULL,
  "matchId" TEXT NOT NULL,
  "viewId" UUID NOT NULL,
  "sequence" INTEGER NOT NULL CHECK ("sequence" > 0),
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TypingLease_pkey" PRIMARY KEY ("leaseId", "matchId", "viewId"),
  CONSTRAINT "TypingLease_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES public."RealtimeLease"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "TypingLease_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES public."Match"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "TypingLease_matchId_expiresAt_idx" ON public."TypingLease" ("matchId", "expiresAt");
ALTER TABLE public."TypingLease" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."TypingLease" FROM PUBLIC;
DO $migration$
DECLARE api_role TEXT;
BEGIN
  FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = api_role) THEN
      EXECUTE format('REVOKE ALL ON TABLE public."TypingLease" FROM %I', api_role);
    END IF;
  END LOOP;
  IF to_regclass('realtime.messages') IS NOT NULL THEN
    EXECUTE $function$
      CREATE FUNCTION bondi_private.prune_typing_leases() RETURNS VOID LANGUAGE sql
      SET search_path = pg_catalog AS $body$
        WITH expired AS (
          SELECT t."leaseId", t."matchId", t."viewId" FROM public."TypingLease" t
          JOIN public."RealtimeLease" l ON l.id = t."leaseId"
          JOIN public."Session" s ON s.id = l."sessionId"
          WHERE l."expiresAt" <= (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
             OR s."expiresAt" <= (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
          LIMIT 1000 FOR UPDATE OF t SKIP LOCKED
        )
        DELETE FROM public."TypingLease" t USING expired e
        WHERE t."leaseId" = e."leaseId" AND t."matchId" = e."matchId" AND t."viewId" = e."viewId";
      $body$;
    $function$;
    REVOKE ALL ON FUNCTION bondi_private.prune_typing_leases() FROM PUBLIC, anon, authenticated;
    PERFORM cron.schedule('bondi-typing-retention', '* * * * *', 'SELECT bondi_private.prune_typing_leases()');
  END IF;
END;
$migration$;
