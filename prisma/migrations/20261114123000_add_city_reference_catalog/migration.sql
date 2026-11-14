CREATE TABLE "LocationCity" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "region" TEXT,
  "country" TEXT NOT NULL,
  "countryCode" TEXT NOT NULL,
  "latitude" DOUBLE PRECISION NOT NULL,
  "longitude" DOUBLE PRECISION NOT NULL,
  "available" BOOLEAN NOT NULL DEFAULT true,
  "sourceVersion" TEXT NOT NULL,
  CONSTRAINT "LocationCity_point_check" CHECK (
    "latitude" BETWEEN -90 AND 90 AND "longitude" BETWEEN -180 AND 180
  ),
  CONSTRAINT "LocationCity_country_check" CHECK ("countryCode" ~ '^[A-Z]{2}$')
);
CREATE INDEX "LocationCity_countryCode_idx" ON "LocationCity" ("countryCode");

CREATE TABLE "LocationCityName" (
  "cityId" TEXT NOT NULL,
  "normalizedName" TEXT NOT NULL,
  PRIMARY KEY ("cityId", "normalizedName"),
  FOREIGN KEY ("cityId") REFERENCES "LocationCity"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "LocationCityName_prefix_idx" ON "LocationCityName"
  ("normalizedName" text_pattern_ops, "cityId");

CREATE TABLE "LocationCatalog" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "version" TEXT NOT NULL,
  "checksums" JSONB NOT NULL,
  "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "cityCount" INTEGER NOT NULL
);
