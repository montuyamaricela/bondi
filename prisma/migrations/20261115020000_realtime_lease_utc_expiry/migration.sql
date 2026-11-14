-- Prisma DateTime columns contain UTC without a time zone. Do not reinterpret
-- those values in the connection's TimeZone when authorizing a subscription.
CREATE OR REPLACE FUNCTION bondi_private.can_receive_realtime(requested_topic TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog AS $$
DECLARE
  claims JSONB := current_setting('request.jwt.claims', true)::jsonb;
BEGIN
  IF claims->>'iss' IS DISTINCT FROM 'bondi-realtime'
    OR claims->>'aud' IS DISTINCT FROM 'authenticated'
    OR claims->>'role' IS DISTINCT FROM 'authenticated'
    OR jsonb_typeof(claims->'exp') IS DISTINCT FROM 'number'
    OR (claims->>'exp')::numeric <= extract(epoch FROM CURRENT_TIMESTAMP)
  THEN RETURN false; END IF;
  RETURN EXISTS (
    SELECT 1 FROM public."RealtimeLease" l
    JOIN public."Session" s ON s.id = l."sessionId" AND s."userId" = l."userId"
    WHERE l.topic = requested_topic AND l.id = claims->>'bondi_lease'
      AND l."userId" = claims->>'sub' AND l."sessionId" = claims->>'bondi_session'
      AND l."expiresAt" > (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
      AND s."expiresAt" > (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
  );
EXCEPTION WHEN OTHERS THEN RETURN false;
END;
$$;
REVOKE ALL ON FUNCTION bondi_private.can_receive_realtime(TEXT) FROM PUBLIC;
