CREATE TYPE "LocationMode" AS ENUM ('OFF', 'DEVICE', 'CITY');
ALTER TABLE "Profile"
  ADD COLUMN "locationMode" "LocationMode" NOT NULL DEFAULT 'OFF',
  ADD COLUMN "locationRevision" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "locationCityId" TEXT,
  ADD COLUMN "cityLocationUpdate" TIMESTAMP(3),
  ADD COLUMN "showCity" BOOLEAN NOT NULL DEFAULT false,
  ALTER COLUMN "showDistance" SET DEFAULT false;

-- Legacy free text stays owner-only and unconfirmed; never guess a catalog ID.
-- PostgreSQL NaN/Infinity fail the bounded comparisons, including partial points.
WITH legacy AS (
  SELECT "id", coalesce(
    "latitude" IS NOT NULL AND "longitude" IS NOT NULL
    AND "latitude" BETWEEN -90 AND 90 AND "longitude" BETWEEN -180 AND 180,
    false
  ) AS valid FROM "Profile"
)
UPDATE "Profile" p SET
  "locationMode" = CASE WHEN legacy.valid THEN 'DEVICE'::"LocationMode" ELSE 'OFF'::"LocationMode" END,
  "latitude" = CASE WHEN legacy.valid THEN p."latitude" ELSE NULL END,
  "longitude" = CASE WHEN legacy.valid THEN p."longitude" ELSE NULL END,
  "lastLocationUpdate" = CASE WHEN legacy.valid THEN p."lastLocationUpdate" ELSE NULL END,
  "showDistance" = CASE WHEN legacy.valid THEN p."showDistance" ELSE false END
FROM legacy WHERE legacy."id" = p."id";

ALTER TABLE "Profile" ADD CONSTRAINT "Profile_locationCityId_fkey"
  FOREIGN KEY ("locationCityId") REFERENCES "LocationCity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "Profile_locationCityId_idx" ON "Profile" ("locationCityId");

ALTER TABLE "Profile" ADD CONSTRAINT "Profile_location_state_check" CHECK (
  ("locationMode" = 'OFF' AND "latitude" IS NULL AND "longitude" IS NULL
    AND "lastLocationUpdate" IS NULL AND "locationCityId" IS NULL AND "cityLocationUpdate" IS NULL
    AND NOT "showCity" AND NOT "showDistance")
  OR ("locationMode" = 'DEVICE' AND "latitude" IS NOT NULL AND "longitude" IS NOT NULL
    AND "latitude" BETWEEN -90 AND 90 AND "longitude" BETWEEN -180 AND 180
    AND "locationCityId" IS NULL AND "cityLocationUpdate" IS NULL AND NOT "showCity")
  OR ("locationMode" = 'CITY' AND "latitude" IS NULL AND "longitude" IS NULL
    AND "lastLocationUpdate" IS NULL AND "locationCityId" IS NOT NULL AND "cityLocationUpdate" IS NOT NULL)
);
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_location_revision_check" CHECK ("locationRevision" >= 0);
