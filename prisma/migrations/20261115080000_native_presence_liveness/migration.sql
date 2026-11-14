ALTER TABLE public."RealtimeLease"
  ADD COLUMN "presenceSequence" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "presenceExpiresAt" TIMESTAMP(3);

-- Existing table RLS and private grants also cover the liveness fields.
CREATE INDEX "RealtimeLease_userId_presenceExpiresAt_idx"
  ON public."RealtimeLease" ("userId", "presenceExpiresAt");
