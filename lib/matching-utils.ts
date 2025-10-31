interface ProfileForMatching {
  interests?: string[] | null
  hobbies?: string[] | null
  lookingFor?: string | null
  relationshipType?: string | null
}

export function calculateCompatibilityScore(
  currentProfile: ProfileForMatching,
  targetProfile: ProfileForMatching
): number {
  let score = 0

  const currentInterests = currentProfile?.interests || []
  const currentHobbies = currentProfile?.hobbies || []
  const currentLookingFor = currentProfile?.lookingFor
  const currentRelationshipType = currentProfile?.relationshipType

  const targetInterests = targetProfile.interests || []
  const targetHobbies = targetProfile.hobbies || []

  const sharedInterests = currentInterests.filter((interest) =>
    targetInterests.includes(interest)
  ).length
  score += sharedInterests * 10

  const sharedHobbies = currentHobbies.filter((hobby) =>
    targetHobbies.includes(hobby)
  ).length
  score += sharedHobbies * 10

  if (
    currentRelationshipType &&
    targetProfile.relationshipType &&
    currentRelationshipType === targetProfile.relationshipType
  ) {
    score += 5
  }

  if (
    currentLookingFor &&
    targetProfile.lookingFor &&
    currentLookingFor === targetProfile.lookingFor
  ) {
    score += 5
  }

  return score
}

export function rankProfilesByCompatibility<T extends ProfileForMatching>(
  currentProfile: ProfileForMatching,
  profiles: T[]
): T[] {
  const profilesWithScores = profiles.map((profile) => ({
    profile,
    score: calculateCompatibilityScore(currentProfile, profile),
  }))

  return profilesWithScores
    .sort((a, b) => b.score - a.score)
    .map((item) => item.profile)
}
