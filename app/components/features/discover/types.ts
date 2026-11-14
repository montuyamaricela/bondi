import type { Gender, RelationshipType } from '@prisma/client';
import type { PublicLocation } from '@/app/components/features/location/types';

export interface DiscoverableProfile extends PublicLocation {
  id: string;
  userId: string;
  name: string;
  age: number;
  bio: string;
  gender: Gender;
  interests: string[];
  hobbies: string[];
  lookingFor: string | null;
  relationshipType: RelationshipType;
  showDistance: boolean;
  photos: ProfilePhoto[];
}

export interface ProfilePhoto {
  id: string;
  url: string;
  key: string;
}

export interface LikeActionRequest {
  targetUserId: string;
  action: 'LIKE' | 'PASS';
}

export interface LikeActionResponse {
  matched: boolean;
  matchId?: string;
  matchedUser?: {
    id: string;
    name: string;
    photo: string | null;
  };
  currentUser?: {
    id: string;
    name: string;
    photo: string | null;
  };
}

export interface DiscoverFilters {
  minAge?: number;
  maxAge?: number;
  distance?: number;
}

export interface MatchNotification {
  matchId: string;
  matchedUser: {
    id: string;
    name: string;
    photo: string | null;
  };
}
