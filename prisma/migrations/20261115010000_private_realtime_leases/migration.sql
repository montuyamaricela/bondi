CREATE TABLE "RealtimeLease" (
  "id" TEXT NOT NULL,
  "topic" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RealtimeLease_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RealtimeLease_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "RealtimeLease_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "RealtimeLease_topic_key" ON "RealtimeLease"("topic");
CREATE INDEX "RealtimeLease_userId_expiresAt_idx" ON "RealtimeLease"("userId", "expiresAt");
CREATE INDEX "RealtimeLease_sessionId_idx" ON "RealtimeLease"("sessionId");
ALTER TABLE "RealtimeLease" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "RealtimeLease" FROM PUBLIC;

CREATE SCHEMA IF NOT EXISTS bondi_private;
REVOKE ALL ON SCHEMA bondi_private FROM PUBLIC;

-- A boolean lookup avoids granting API roles access to sessions or capabilities.
CREATE FUNCTION bondi_private.can_receive_realtime(requested_topic TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog AS $$
DECLARE
  claims JSONB := current_setting('request.jwt.claims', true)::jsonb;
BEGIN
  IF claims->>'iss' IS DISTINCT FROM 'bondi-realtime'
    OR claims->>'aud' IS DISTINCT FROM 'authenticated'
    OR claims->>'role' IS DISTINCT FROM 'authenticated'
    OR (claims->>'exp')::numeric <= extract(epoch FROM CURRENT_TIMESTAMP)
  THEN RETURN false; END IF;
  RETURN EXISTS (
    SELECT 1 FROM public."RealtimeLease" l
    JOIN public."Session" s ON s.id = l."sessionId" AND s."userId" = l."userId"
    WHERE l.topic = requested_topic AND l.id = claims->>'bondi_lease'
      AND l."userId" = claims->>'sub' AND l."sessionId" = claims->>'bondi_session'
      AND l."expiresAt" > CURRENT_TIMESTAMP AND s."expiresAt" > CURRENT_TIMESTAMP
  );
EXCEPTION WHEN OTHERS THEN RETURN false;
END;
$$;
REVOKE ALL ON FUNCTION bondi_private.can_receive_realtime(TEXT) FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON public."RealtimeLease" FROM anon;
    REVOKE ALL ON SCHEMA bondi_private FROM anon;
    REVOKE ALL ON FUNCTION bondi_private.can_receive_realtime(TEXT) FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON public."RealtimeLease" FROM authenticated;
    GRANT USAGE ON SCHEMA bondi_private TO authenticated;
    GRANT EXECUTE ON FUNCTION bondi_private.can_receive_realtime(TEXT) TO authenticated;
  END IF;
  IF to_regclass('realtime.messages') IS NOT NULL THEN
    CREATE POLICY bondi_session_receive ON realtime.messages
      FOR SELECT TO authenticated
      USING (extension = 'broadcast' AND bondi_private.can_receive_realtime(realtime.topic()));
  END IF;
END;
$$;
