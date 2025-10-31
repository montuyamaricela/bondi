import { PrismaClient, Gender, RelationshipType, GenderPreference, LikeAction, Profile, User } from '@prisma/client'
import { hashPassword } from 'better-auth/crypto'

const prisma = new PrismaClient()

const users = [
  {
    email: 'montuyamaricela@gmail.com',
    name: 'Maricel Montuya',
    age: 26,
    bio: 'Software developer and tech enthusiast. Love coding, coffee, and exploring new places. Always up for good conversations and new adventures!',
    gender: Gender.FEMALE,
    location: 'San Francisco, CA',
    interests: ['Technology', 'Travel', 'Coffee', 'Music'],
    hobbies: ['Coding', 'Reading', 'Photography'],
    lookingFor: 'Someone genuine and fun to connect with',
    relationshipType: RelationshipType.SERIOUS,
    genderPreference: GenderPreference.MALE,
    photos: [
      'https://picsum.photos/seed/maricel1/800/1000',
      'https://picsum.photos/seed/maricel2/800/1000',
      'https://picsum.photos/seed/maricel3/800/1000',
    ],
  },
  {
    email: 'alex@example.com',
    name: 'Alex Thompson',
    age: 28,
    bio: 'Designer and creative thinker. Passionate about art, design, and making meaningful connections. Let\'s chat!',
    gender: Gender.MALE,
    location: 'San Francisco, CA',
    interests: ['Design', 'Art', 'Photography', 'Travel'],
    hobbies: ['Designing', 'Sketching', 'Exploring'],
    lookingFor: 'Creative souls and interesting conversations',
    relationshipType: RelationshipType.CASUAL,
    genderPreference: GenderPreference.FEMALE,
    photos: [
      'https://picsum.photos/seed/alex1/800/1000',
      'https://picsum.photos/seed/alex2/800/1000',
      'https://picsum.photos/seed/alex3/800/1000',
      'https://picsum.photos/seed/alex4/800/1000',
    ],
  },
  {
    email: 'bob@example.com',
    name: 'Bob Smith',
    age: 28,
    bio: 'Tech enthusiast and weekend warrior. Building the future one line of code at a time. Love gaming and outdoor adventures.',
    gender: Gender.MALE,
    location: 'San Francisco, CA',
    interests: ['Technology', 'Gaming', 'Music', 'Fitness'],
    hobbies: ['Coding', 'Rock Climbing', 'Guitar'],
    lookingFor: 'Looking for someone fun and spontaneous',
    relationshipType: RelationshipType.CASUAL,
    genderPreference: GenderPreference.FEMALE,
    photos: [
      'https://picsum.photos/seed/bob1/800/1000',
      'https://picsum.photos/seed/bob2/800/1000',
      'https://picsum.photos/seed/bob3/800/1000',
      'https://picsum.photos/seed/bob4/800/1000',
    ],
  },
  {
    email: 'alice@example.com',
    name: 'Alice Johnson',
    age: 25,
    bio: 'Adventure seeker, coffee lover, and bookworm. Always up for trying new restaurants and exploring hiking trails.',
    gender: Gender.FEMALE,
    location: 'San Francisco, CA',
    interests: ['Travel', 'Photography', 'Cooking', 'Yoga'],
    hobbies: ['Reading', 'Hiking', 'Painting'],
    lookingFor: 'Someone who loves adventure and deep conversations',
    relationshipType: RelationshipType.SERIOUS,
    genderPreference: GenderPreference.MALE,
    photos: [
      'https://picsum.photos/seed/alice1/800/1000',
      'https://picsum.photos/seed/alice2/800/1000',
      'https://picsum.photos/seed/alice3/800/1000',
    ],
  },
  {
    email: 'charlie@example.com',
    name: 'Charlie Davis',
    age: 30,
    bio: 'Foodie, wine enthusiast, and amateur chef. Always exploring new cuisines and cultures. Life is too short for boring food!',
    gender: Gender.MALE,
    location: 'San Francisco, CA',
    interests: ['Food', 'Wine', 'Travel', 'Art'],
    hobbies: ['Cooking', 'Wine Tasting', 'Photography'],
    lookingFor: 'Someone to share culinary adventures with',
    relationshipType: RelationshipType.SERIOUS,
    genderPreference: GenderPreference.EVERYONE,
    photos: [
      'https://picsum.photos/seed/charlie1/800/1000',
      'https://picsum.photos/seed/charlie2/800/1000',
      'https://picsum.photos/seed/charlie3/800/1000',
    ],
  },
]

async function main() {
  console.log('Starting seed...')

  // Clear existing data
  console.log('Clearing existing data...')
  await prisma.message.deleteMany()
  await prisma.match.deleteMany()
  await prisma.like.deleteMany()
  await prisma.file.deleteMany()
  await prisma.profile.deleteMany()
  await prisma.session.deleteMany()
  await prisma.account.deleteMany()
  await prisma.user.deleteMany()

  const hashedPassword = await hashPassword('password123')
  const createdUsers: { user: User; profile: Profile }[] = []

  for (const userData of users) {
    console.log(`Creating user: ${userData.name}`)

    const user = await prisma.user.create({
      data: {
        email: userData.email,
        name: userData.name,
        emailVerified: true,
      },
    })

    await prisma.account.create({
      data: {
        userId: user.id,
        accountId: userData.email,
        providerId: 'credential',
        password: hashedPassword,
      },
    })

    const profile = await prisma.profile.create({
      data: {
        userId: user.id,
        name: userData.name,
        age: userData.age,
        bio: userData.bio,
        gender: userData.gender,
        location: userData.location,
        interests: userData.interests,
        hobbies: userData.hobbies,
        lookingFor: userData.lookingFor,
        relationshipType: userData.relationshipType,
        genderPreference: userData.genderPreference,
      },
    })

    for (let i = 0; i < userData.photos.length; i++) {
      await prisma.file.create({
        data: {
          userId: user.id,
          url: userData.photos[i],
          key: `${user.id}-photo-${i}`,
          name: `photo-${i}.jpg`,
          size: 1024 * 100,
          type: 'image/jpeg',
        },
      })
    }

    createdUsers.push({ user, profile })
  }

  console.log('Creating likes and matches...')

  // Create mutual matches
  const matches = [
    [0, 1],   // Maricel & Alex - mutual match
    [0, 2],   // Maricel & Bob - mutual match
    [3, 4],   // Alice & Charlie - mutual match
  ]

  const matchRecords = []

  for (const [idx1, idx2] of matches) {
    await prisma.like.create({
      data: {
        userId: createdUsers[idx1].user.id,
        targetUserId: createdUsers[idx2].user.id,
        action: LikeAction.LIKE,
      },
    })

    await prisma.like.create({
      data: {
        userId: createdUsers[idx2].user.id,
        targetUserId: createdUsers[idx1].user.id,
        action: LikeAction.LIKE,
      },
    })

    const match = await prisma.match.create({
      data: {
        user1Id: createdUsers[idx1].user.id,
        user2Id: createdUsers[idx2].user.id,
      },
    })

    matchRecords.push({ match, user1Idx: idx1, user2Idx: idx2 })
  }

  // Create one-sided like (Bob likes Alice, but Alice hasn't liked Bob yet)
  const nonMutualLikes = [
    [2, 3], // Bob likes Alice (Alice already matched with Charlie)
  ]

  for (const [idx1, idx2] of nonMutualLikes) {
    await prisma.like.create({
      data: {
        userId: createdUsers[idx1].user.id,
        targetUserId: createdUsers[idx2].user.id,
        action: LikeAction.LIKE,
      },
    })
  }

  console.log('Creating messages...')

  // Create messages for first 2 matches
  for (let i = 0; i < Math.min(2, matchRecords.length); i++) {
    const { match, user1Idx, user2Idx } = matchRecords[i]
    const user1 = createdUsers[user1Idx]
    const user2 = createdUsers[user2Idx]

    await prisma.message.create({
      data: {
        matchId: match.id,
        senderId: user1.user.id,
        content: `Hey ${user2.profile.name}! Great to match with you!`,
        readAt: new Date(),
      },
    })

    await prisma.message.create({
      data: {
        matchId: match.id,
        senderId: user2.user.id,
        content: `Hi ${user1.profile.name}! Thanks, I saw your profile and thought we might get along!`,
        readAt: new Date(),
      },
    })

    await prisma.message.create({
      data: {
        matchId: match.id,
        senderId: user1.user.id,
        content: 'Would love to grab coffee sometime!',
      },
    })
  }

  console.log('Seed completed successfully!')
  console.log(`Created ${createdUsers.length} users with profiles and photos`)
  console.log(`Created ${matches.length} mutual matches`)
  console.log(`Created ${nonMutualLikes.length} one-sided likes`)
  console.log('\nTest credentials (all users have the same password):')
  console.log('Password: password123')
  console.log('\n📋 Users:')
  console.log('1. montuyamaricela@gmail.com - Maricel Montuya (Female, 26) - 2 matches')
  console.log('2. alex@example.com - Alex Thompson (Male, 28) - 1 match with Maricel')
  console.log('3. bob@example.com - Bob Smith (Male, 28) - 1 match with Maricel')
  console.log('4. alice@example.com - Alice Johnson (Female, 25) - 1 match with Charlie')
  console.log('5. charlie@example.com - Charlie Davis (Male, 30) - 1 match with Alice')
  console.log('\n🔥 Match Status:')
  console.log('- Maricel ↔️ Alex (matched)')
  console.log('- Maricel ↔️ Bob (matched)')
  console.log('- Alice ↔️ Charlie (matched)')
  console.log('- Bob → Alice (Bob likes Alice, waiting for reciprocal)')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
