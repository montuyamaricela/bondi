import { db } from "@/lib/db"

export async function getProfileByUserId(userId: string) {
  return await db.profile.findUnique({
    where: { userId },
  })
}
