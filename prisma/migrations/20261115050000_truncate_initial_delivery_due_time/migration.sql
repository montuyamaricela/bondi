-- TIMESTAMP(3) rounds up; a new intent must already be due in its accepting transaction.
ALTER TABLE public."MessageDelivery" ALTER COLUMN "nextAttemptAt"
  SET DEFAULT date_trunc('milliseconds', (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'));
