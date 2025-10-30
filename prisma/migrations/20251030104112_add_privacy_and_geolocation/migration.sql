-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "lastLocationUpdate" TIMESTAMP(3),
ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION,
ADD COLUMN     "showDistance" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "showOnlineStatus" BOOLEAN NOT NULL DEFAULT true;
