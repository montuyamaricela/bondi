export interface Profile {
  id: string
  userId: string
  name: string
  age: number
  bio: string
  gender: 'MALE' | 'FEMALE' | 'NON_BINARY' | 'OTHER'
  location: string | null
  interests: string[]
  hobbies: string[]
  lookingFor: string | null
  relationshipType: 'CASUAL' | 'SERIOUS' | 'FRIENDSHIP' | 'NOT_SURE'
  genderPreference: 'MALE' | 'FEMALE' | 'EVERYONE'
  createdAt: string
  updatedAt: string
}

export interface ProfileResponse {
  profile: Profile | null
}
