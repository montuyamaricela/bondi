-- Preserve legacy account fields while completing the auth adapter contract.
ALTER TABLE "Account"
ADD COLUMN "accessTokenExpiresAt" TIMESTAMP(3),
ADD COLUMN "refreshTokenExpiresAt" TIMESTAMP(3),
ADD COLUMN "scope" TEXT;

CREATE TABLE "Verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Verification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Verification_identifier_idx" ON "Verification"("identifier");
