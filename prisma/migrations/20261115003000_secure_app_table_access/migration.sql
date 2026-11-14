-- Server ownership checks remain authoritative; browser API roles have no app-table access.
-- Do not alter Supabase-owned auth/realtime/storage objects or their ownership.
DO $$
DECLARE
  app_table TEXT;
  api_role TEXT;
BEGIN
  FOREACH app_table IN ARRAY ARRAY[
    'User', 'Session', 'Account', 'Verification', 'Profile', 'File', 'Like', 'Match',
    'Message', 'MessageAttachment', 'MessageDelivery', 'Notification',
    'LocationCity', 'LocationCityName', 'LocationCatalog', '_prisma_migrations'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', app_table);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC', app_table);
    FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
      -- These provider roles do not exist on ordinary PostgreSQL installations.
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = api_role) THEN
        EXECUTE format('REVOKE ALL ON TABLE public.%I FROM %I', app_table, api_role);
      END IF;
    END LOOP;
  END LOOP;
  -- Future application tables created by this migrator start private as well.
  ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC;
  FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = api_role) THEN
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %I', api_role);
    END IF;
  END LOOP;
END $$;
