import type { Gender, RelationshipType, GenderPreference } from "@prisma/client"

export interface DiscoverableProfile {
  id: string
  userId: string
  name: string
  age: number
  bio: string
  gender: Gender
  location: string | null
  interests: string[]
  hobbies: string[]
  lookingFor: string | null
  relationshipType: RelationshipType
  photos: ProfilePhoto[]
}

export interface ProfilePhoto {
  id: string
  url: string
  key: string
}

export interface LikeActionRequest {
  targetUserId: string
  action: "LIKE" | "PASS"
}

export interface LikeActionResponse {
  matched: boolean
  matchId?: string
  matchedUser?: {
    id: string
    name: string
    photo: string | null
  }
  currentUser?: {
    id: string
    name: string
    photo: string | null
  }
}

export interface DiscoverFilters {
  minAge?: number
  maxAge?: number
  distance?: number
  genderPreference?: GenderPreference
}

export interface MatchNotification {
  matchId: string
  matchedUser: {
    id: string
    name: string
    photo: string | null
  }
}
