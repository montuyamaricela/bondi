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
    email: 'montuyamaricela+test@gmail.com',
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
    email: 'charlie@example.com',
    name: 'Charlie Davis',
    age: 30,
    bio: 'Foodie, wine enthusiast, and amateur chef. Always exploring new cuisines and cultures. Life is too short for boring food!',
    gender: Gender.MALE,
    location: 'Los Angeles, CA',
    interests: ['Food', 'Wine', 'Travel', 'Art'],
    hobbies: ['Cooking', 'Wine Tasting', 'Photography'],
    lookingFor: 'Someone to share culinary adventures with',
    relationshipType: RelationshipType.SERIOUS,
    genderPreference: GenderPreference.EVERYONE,
    photos: [
      'https://picsum.photos/seed/charlie1/800/1000',
      'https://picsum.photos/seed/charlie2/800/1000',
    ],
  },
  {
    email: 'diana@example.com',
    name: 'Diana Martinez',
    age: 26,
    bio: 'Yoga instructor and wellness coach. Passionate about healthy living, meditation, and sustainable lifestyle.',
    gender: Gender.FEMALE,
    location: 'Los Angeles, CA',
    interests: ['Wellness', 'Yoga', 'Meditation', 'Sustainability'],
    hobbies: ['Yoga', 'Running', 'Gardening'],
    lookingFor: 'Seeking a mindful connection',
    relationshipType: RelationshipType.SERIOUS,
    genderPreference: GenderPreference.MALE,
    photos: [
      'https://picsum.photos/seed/diana1/800/1000',
      'https://picsum.photos/seed/diana2/800/1000',
      'https://picsum.photos/seed/diana3/800/1000',
      'https://picsum.photos/seed/diana4/800/1000',
      'https://picsum.photos/seed/diana5/800/1000',
    ],
  },
  {
    email: 'emma@example.com',
    name: 'Emma Wilson',
    age: 24,
    bio: 'Artist and creative soul. Love painting, music festivals, and spontaneous road trips. Life is my canvas!',
    gender: Gender.FEMALE,
    location: 'Portland, OR',
    interests: ['Art', 'Music', 'Travel', 'Fashion'],
    hobbies: ['Painting', 'Dancing', 'Thrifting'],
    lookingFor: 'Creative spirits welcome',
    relationshipType: RelationshipType.CASUAL,
    genderPreference: GenderPreference.EVERYONE,
    photos: [
      'https://picsum.photos/seed/emma1/800/1000',
      'https://picsum.photos/seed/emma2/800/1000',
      'https://picsum.photos/seed/emma3/800/1000',
    ],
  },
  {
    email: 'frank@example.com',
    name: 'Frank Thompson',
    age: 32,
    bio: 'Entrepreneur and fitness enthusiast. Building my dream while staying in shape. Love basketball and morning runs.',
    gender: Gender.MALE,
    location: 'Austin, TX',
    interests: ['Business', 'Fitness', 'Sports', 'Technology'],
    hobbies: ['Basketball', 'Running', 'Reading'],
    lookingFor: 'Someone ambitious and driven',
    relationshipType: RelationshipType.SERIOUS,
    genderPreference: GenderPreference.FEMALE,
    photos: [
      'https://picsum.photos/seed/frank1/800/1000',
      'https://picsum.photos/seed/frank2/800/1000',
      'https://picsum.photos/seed/frank3/800/1000',
      'https://picsum.photos/seed/frank4/800/1000',
    ],
  },
  {
    email: 'grace@example.com',
    name: 'Grace Lee',
    age: 27,
    bio: 'Software engineer by day, gamer by night. Love anime, board games, and bubble tea. Let\'s talk tech and grab boba!',
    gender: Gender.FEMALE,
    location: 'Seattle, WA',
    interests: ['Gaming', 'Anime', 'Technology', 'Food'],
    hobbies: ['Gaming', 'Coding', 'Baking'],
    lookingFor: 'Fellow nerd looking for player 2',
    relationshipType: RelationshipType.CASUAL,
    genderPreference: GenderPreference.MALE,
    photos: [
      'https://picsum.photos/seed/grace1/800/1000',
      'https://picsum.photos/seed/grace2/800/1000',
    ],
  },
  {
    email: 'henry@example.com',
    name: 'Henry Brown',
    age: 29,
    bio: 'Musician and music teacher. Play guitar, piano, and drums. Love live concerts and jam sessions.',
    gender: Gender.MALE,
    location: 'Nashville, TN',
    interests: ['Music', 'Concerts', 'Teaching', 'Art'],
    hobbies: ['Playing Guitar', 'Songwriting', 'Collecting Vinyl'],
    lookingFor: 'Music lover to vibe with',
    relationshipType: RelationshipType.NOT_SURE,
    genderPreference: GenderPreference.FEMALE,
    photos: [
      'https://picsum.photos/seed/henry1/800/1000',
      'https://picsum.photos/seed/henry2/800/1000',
      'https://picsum.photos/seed/henry3/800/1000',
    ],
  },
  {
    email: 'isabel@example.com',
    name: 'Isabel Garcia',
    age: 31,
    bio: 'Travel blogger and photographer. Been to 40+ countries and counting. Always planning my next adventure!',
    gender: Gender.FEMALE,
    location: 'Miami, FL',
    interests: ['Travel', 'Photography', 'Writing', 'Culture'],
    hobbies: ['Photography', 'Blogging', 'Scuba Diving'],
    lookingFor: 'Travel companion wanted',
    relationshipType: RelationshipType.CASUAL,
    genderPreference: GenderPreference.MALE,
    photos: [
      'https://picsum.photos/seed/isabel1/800/1000',
      'https://picsum.photos/seed/isabel2/800/1000',
      'https://picsum.photos/seed/isabel3/800/1000',
      'https://picsum.photos/seed/isabel4/800/1000',
      'https://picsum.photos/seed/isabel5/800/1000',
      'https://picsum.photos/seed/isabel6/800/1000',
    ],
  },
  {
    email: 'jack@example.com',
    name: 'Jack Anderson',
    age: 33,
    bio: 'Chef and food truck owner. Creating delicious street food and experimenting with flavors. Foodie life!',
    gender: Gender.MALE,
    location: 'Chicago, IL',
    interests: ['Cooking', 'Food', 'Business', 'Travel'],
    hobbies: ['Cooking', 'Food Tasting', 'Cycling'],
    lookingFor: 'Someone who appreciates good food',
    relationshipType: RelationshipType.SERIOUS,
    genderPreference: GenderPreference.FEMALE,
    photos: [
      'https://picsum.photos/seed/jack1/800/1000',
      'https://picsum.photos/seed/jack2/800/1000',
      'https://picsum.photos/seed/jack3/800/1000',
    ],
  },
  {
    email: 'kate@example.com',
    name: 'Kate Miller',
    age: 26,
    bio: 'Marketing professional and social butterfly. Love brunch dates, rooftop bars, and exploring the city.',
    gender: Gender.FEMALE,
    location: 'New York, NY',
    interests: ['Marketing', 'Socializing', 'Fashion', 'Food'],
    hobbies: ['Shopping', 'Brunching', 'Networking'],
    lookingFor: 'Looking for someone fun and social',
    relationshipType: RelationshipType.CASUAL,
    genderPreference: GenderPreference.MALE,
    photos: [
      'https://picsum.photos/seed/kate1/800/1000',
      'https://picsum.photos/seed/kate2/800/1000',
      'https://picsum.photos/seed/kate3/800/1000',
      'https://picsum.photos/seed/kate4/800/1000',
    ],
  },
  {
    email: 'liam@example.com',
    name: 'Liam Taylor',
    age: 27,
    bio: 'Personal trainer and nutrition coach. Helping people achieve their fitness goals. Gym is my second home!',
    gender: Gender.MALE,
    location: 'Denver, CO',
    interests: ['Fitness', 'Nutrition', 'Sports', 'Wellness'],
    hobbies: ['Weightlifting', 'Meal Prep', 'Hiking'],
    lookingFor: 'Active lifestyle partner',
    relationshipType: RelationshipType.SERIOUS,
    genderPreference: GenderPreference.FEMALE,
    photos: [
      'https://picsum.photos/seed/liam1/800/1000',
      'https://picsum.photos/seed/liam2/800/1000',
    ],
  },
  {
    email: 'maya@example.com',
    name: 'Maya Patel',
    age: 25,
    bio: 'Medical student with a passion for helping others. Love coffee, cats, and crime documentaries.',
    gender: Gender.FEMALE,
    location: 'Boston, MA',
    interests: ['Medicine', 'Science', 'Cats', 'True Crime'],
    hobbies: ['Reading', 'Volunteering', 'Watching Documentaries'],
    lookingFor: 'Kind soul with a good heart',
    relationshipType: RelationshipType.SERIOUS,
    genderPreference: GenderPreference.MALE,
    photos: [
      'https://picsum.photos/seed/maya1/800/1000',
      'https://picsum.photos/seed/maya2/800/1000',
      'https://picsum.photos/seed/maya3/800/1000',
    ],
  },
  {
    email: 'noah@example.com',
    name: 'Noah Rodriguez',
    age: 30,
    bio: 'Architect and design enthusiast. Creating beautiful spaces and exploring modern architecture worldwide.',
    gender: Gender.MALE,
    location: 'San Diego, CA',
    interests: ['Architecture', 'Design', 'Art', 'Travel'],
    hobbies: ['Sketching', 'Museum Visits', 'Photography'],
    lookingFor: 'Creative mind to share ideas with',
    relationshipType: RelationshipType.NOT_SURE,
    genderPreference: GenderPreference.EVERYONE,
    photos: [
      'https://picsum.photos/seed/noah1/800/1000',
      'https://picsum.photos/seed/noah2/800/1000',
      'https://picsum.photos/seed/noah3/800/1000',
      'https://picsum.photos/seed/noah4/800/1000',
    ],
  },
  {
    email: 'olivia@example.com',
    name: 'Olivia White',
    age: 28,
    bio: 'Environmental scientist fighting for a better planet. Love nature, sustainability, and outdoor adventures.',
    gender: Gender.FEMALE,
    location: 'Portland, OR',
    interests: ['Environment', 'Sustainability', 'Nature', 'Science'],
    hobbies: ['Hiking', 'Camping', 'Gardening'],
    lookingFor: 'Eco-conscious partner',
    relationshipType: RelationshipType.SERIOUS,
    genderPreference: GenderPreference.MALE,
    photos: [
      'https://picsum.photos/seed/olivia1/800/1000',
      'https://picsum.photos/seed/olivia2/800/1000',
      'https://picsum.photos/seed/olivia3/800/1000',
    ],
  },
  {
    email: 'peter@example.com',
    name: 'Peter Chen',
    age: 29,
    bio: 'Data scientist and AI enthusiast. Working on cool ML projects. Love sci-fi movies and coffee experiments.',
    gender: Gender.MALE,
    location: 'San Francisco, CA',
    interests: ['AI', 'Technology', 'Coffee', 'Sci-Fi'],
    hobbies: ['Coding', 'Coffee Roasting', 'Reading'],
    lookingFor: 'Intellectual conversations and good vibes',
    relationshipType: RelationshipType.CASUAL,
    genderPreference: GenderPreference.EVERYONE,
    photos: [
      'https://picsum.photos/seed/peter1/800/1000',
      'https://picsum.photos/seed/peter2/800/1000',
      'https://picsum.photos/seed/peter3/800/1000',
    ],
  },
  {
    email: 'quinn@example.com',
    name: 'Quinn Harper',
    age: 26,
    bio: 'Freelance writer and poet. Words are my passion. Love bookstores, coffee shops, and deep conversations.',
    gender: Gender.NON_BINARY,
    location: 'Brooklyn, NY',
    interests: ['Writing', 'Literature', 'Poetry', 'Coffee'],
    hobbies: ['Writing', 'Reading', 'Journaling'],
    lookingFor: 'Fellow wordsmith',
    relationshipType: RelationshipType.SERIOUS,
    genderPreference: GenderPreference.EVERYONE,
    photos: [
      'https://picsum.photos/seed/quinn1/800/1000',
      'https://picsum.photos/seed/quinn2/800/1000',
      'https://picsum.photos/seed/quinn3/800/1000',
      'https://picsum.photos/seed/quinn4/800/1000',
    ],
  },
  {
    email: 'rachel@example.com',
    name: 'Rachel Kim',
    age: 27,
    bio: 'Fashion designer bringing bold ideas to life. Love streetwear, vintage finds, and fashion shows.',
    gender: Gender.FEMALE,
    location: 'Los Angeles, CA',
    interests: ['Fashion', 'Design', 'Art', 'Music'],
    hobbies: ['Sewing', 'Thrifting', 'Sketching'],
    lookingFor: 'Someone with style and substance',
    relationshipType: RelationshipType.CASUAL,
    genderPreference: GenderPreference.MALE,
    photos: [
      'https://picsum.photos/seed/rachel1/800/1000',
      'https://picsum.photos/seed/rachel2/800/1000',
      'https://picsum.photos/seed/rachel3/800/1000',
    ],
  },
  {
    email: 'sam@example.com',
    name: 'Sam Rivers',
    age: 31,
    bio: 'Wildlife photographer capturing nature\'s beauty. Always chasing the perfect shot in remote locations.',
    gender: Gender.MALE,
    location: 'Boulder, CO',
    interests: ['Photography', 'Nature', 'Wildlife', 'Travel'],
    hobbies: ['Photography', 'Camping', 'Bird Watching'],
    lookingFor: 'Adventure partner who loves the outdoors',
    relationshipType: RelationshipType.SERIOUS,
    genderPreference: GenderPreference.FEMALE,
    photos: [
      'https://picsum.photos/seed/sam1/800/1000',
      'https://picsum.photos/seed/sam2/800/1000',
      'https://picsum.photos/seed/sam3/800/1000',
      'https://picsum.photos/seed/sam4/800/1000',
      'https://picsum.photos/seed/sam5/800/1000',
    ],
  },
  {
    email: 'tina@example.com',
    name: 'Tina Brooks',
    age: 24,
    bio: 'Dance instructor and choreographer. Movement is life! Love salsa, hip-hop, and contemporary dance.',
    gender: Gender.FEMALE,
    location: 'Miami, FL',
    interests: ['Dance', 'Music', 'Fitness', 'Performance'],
    hobbies: ['Dancing', 'Teaching', 'Going to Concerts'],
    lookingFor: 'Someone who can keep up on the dance floor',
    relationshipType: RelationshipType.CASUAL,
    genderPreference: GenderPreference.MALE,
    photos: [
      'https://picsum.photos/seed/tina1/800/1000',
      'https://picsum.photos/seed/tina2/800/1000',
    ],
  },
  {
    email: 'uma@example.com',
    name: 'Uma Desai',
    age: 29,
    bio: 'Veterinarian with a heart for animals. Every day is about saving lives and making tails wag!',
    gender: Gender.FEMALE,
    location: 'San Diego, CA',
    interests: ['Animals', 'Veterinary', 'Nature', 'Hiking'],
    hobbies: ['Volunteering', 'Hiking', 'Reading'],
    lookingFor: 'Animal lover who shares my passion',
    relationshipType: RelationshipType.SERIOUS,
    genderPreference: GenderPreference.MALE,
    photos: [
      'https://picsum.photos/seed/uma1/800/1000',
      'https://picsum.photos/seed/uma2/800/1000',
      'https://picsum.photos/seed/uma3/800/1000',
      'https://picsum.photos/seed/uma4/800/1000',
    ],
  },
  {
    email: 'victor@example.com',
    name: 'Victor Santos',
    age: 34,
    bio: 'Craft beer brewer perfecting my recipes. Love trying new beers and hosting tasting sessions.',
    gender: Gender.MALE,
    location: 'Portland, OR',
    interests: ['Beer', 'Brewing', 'Food', 'Music'],
    hobbies: ['Brewing', 'Beer Tasting', 'Cooking'],
    lookingFor: 'Beer enthusiast to share pints with',
    relationshipType: RelationshipType.NOT_SURE,
    genderPreference: GenderPreference.FEMALE,
    photos: [
      'https://picsum.photos/seed/victor1/800/1000',
      'https://picsum.photos/seed/victor2/800/1000',
      'https://picsum.photos/seed/victor3/800/1000',
    ],
  },
  {
    email: 'wendy@example.com',
    name: 'Wendy Park',
    age: 25,
    bio: 'UX designer creating beautiful digital experiences. Love minimalism, good design, and matcha lattes.',
    gender: Gender.FEMALE,
    location: 'Seattle, WA',
    interests: ['Design', 'Technology', 'Art', 'Coffee'],
    hobbies: ['Designing', 'Sketching', 'Café Hopping'],
    lookingFor: 'Creative soul who appreciates good design',
    relationshipType: RelationshipType.CASUAL,
    genderPreference: GenderPreference.MALE,
    photos: [
      'https://picsum.photos/seed/wendy1/800/1000',
      'https://picsum.photos/seed/wendy2/800/1000',
      'https://picsum.photos/seed/wendy3/800/1000',
    ],
  },
  {
    email: 'xavier@example.com',
    name: 'Xavier James',
    age: 30,
    bio: 'Stand-up comedian making people laugh for a living. Life\'s too short to be serious all the time!',
    gender: Gender.MALE,
    location: 'New York, NY',
    interests: ['Comedy', 'Writing', 'Performance', 'Movies'],
    hobbies: ['Writing Jokes', 'Watching Comedy', 'Performing'],
    lookingFor: 'Someone who laughs at my jokes',
    relationshipType: RelationshipType.CASUAL,
    genderPreference: GenderPreference.FEMALE,
    photos: [
      'https://picsum.photos/seed/xavier1/800/1000',
      'https://picsum.photos/seed/xavier2/800/1000',
    ],
  },
  {
    email: 'yara@example.com',
    name: 'Yara Hassan',
    age: 27,
    bio: 'Civil engineer building infrastructure that matters. Love problem-solving and making a real-world impact.',
    gender: Gender.FEMALE,
    location: 'Houston, TX',
    interests: ['Engineering', 'Architecture', 'Travel', 'Fitness'],
    hobbies: ['Running', 'Sketching', 'Traveling'],
    lookingFor: 'Ambitious partner with big dreams',
    relationshipType: RelationshipType.SERIOUS,
    genderPreference: GenderPreference.MALE,
    photos: [
      'https://picsum.photos/seed/yara1/800/1000',
      'https://picsum.photos/seed/yara2/800/1000',
      'https://picsum.photos/seed/yara3/800/1000',
      'https://picsum.photos/seed/yara4/800/1000',
    ],
  },
  {
    email: 'zack@example.com',
    name: 'Zack Morgan',
    age: 28,
    bio: 'Professional photographer capturing life\'s moments. Love portraits, weddings, and street photography.',
    gender: Gender.MALE,
    location: 'Austin, TX',
    interests: ['Photography', 'Art', 'Travel', 'Music'],
    hobbies: ['Photography', 'Editing', 'Concerts'],
    lookingFor: 'Muse and adventure buddy',
    relationshipType: RelationshipType.NOT_SURE,
    genderPreference: GenderPreference.EVERYONE,
    photos: [
      'https://picsum.photos/seed/zack1/800/1000',
      'https://picsum.photos/seed/zack2/800/1000',
      'https://picsum.photos/seed/zack3/800/1000',
      'https://picsum.photos/seed/zack4/800/1000',
      'https://picsum.photos/seed/zack5/800/1000',
    ],
  },
  {
    email: 'amber@example.com',
    name: 'Amber Foster',
    age: 26,
    bio: 'Social media manager helping brands tell their story. Love content creation and staying on top of trends.',
    gender: Gender.FEMALE,
    location: 'Los Angeles, CA',
    interests: ['Social Media', 'Marketing', 'Photography', 'Fashion'],
    hobbies: ['Content Creation', 'Blogging', 'Shopping'],
    lookingFor: 'Social butterfly who loves good vibes',
    relationshipType: RelationshipType.CASUAL,
    genderPreference: GenderPreference.MALE,
    photos: [
      'https://picsum.photos/seed/amber1/800/1000',
      'https://picsum.photos/seed/amber2/800/1000',
      'https://picsum.photos/seed/amber3/800/1000',
    ],
  },
  {
    email: 'blake@example.com',
    name: 'Blake Turner',
    age: 32,
    bio: 'Real estate investor and property developer. Building wealth and beautiful properties one deal at a time.',
    gender: Gender.MALE,
    location: 'Miami, FL',
    interests: ['Real Estate', 'Business', 'Finance', 'Travel'],
    hobbies: ['Golf', 'Networking', 'Reading'],
    lookingFor: 'Partner who values success',
    relationshipType: RelationshipType.SERIOUS,
    genderPreference: GenderPreference.FEMALE,
    photos: [
      'https://picsum.photos/seed/blake1/800/1000',
      'https://picsum.photos/seed/blake2/800/1000',
      'https://picsum.photos/seed/blake3/800/1000',
    ],
  },
  {
    email: 'chloe@example.com',
    name: 'Chloe Bennett',
    age: 23,
    bio: 'Graphic designer and illustrator. Creating visual magic and colorful worlds. Love anime and digital art.',
    gender: Gender.FEMALE,
    location: 'San Francisco, CA',
    interests: ['Design', 'Art', 'Anime', 'Gaming'],
    hobbies: ['Drawing', 'Gaming', 'Watching Anime'],
    lookingFor: 'Creative geek to share hobbies with',
    relationshipType: RelationshipType.CASUAL,
    genderPreference: GenderPreference.EVERYONE,
    photos: [
      'https://picsum.photos/seed/chloe1/800/1000',
      'https://picsum.photos/seed/chloe2/800/1000',
    ],
  },
  {
    email: 'dylan@example.com',
    name: 'Dylan Cooper',
    age: 29,
    bio: 'Marine biologist studying ocean life. Passionate about conservation and protecting our seas.',
    gender: Gender.MALE,
    location: 'San Diego, CA',
    interests: ['Marine Biology', 'Science', 'Diving', 'Nature'],
    hobbies: ['Scuba Diving', 'Research', 'Photography'],
    lookingFor: 'Ocean lover who cares about the planet',
    relationshipType: RelationshipType.SERIOUS,
    genderPreference: GenderPreference.FEMALE,
    photos: [
      'https://picsum.photos/seed/dylan1/800/1000',
      'https://picsum.photos/seed/dylan2/800/1000',
      'https://picsum.photos/seed/dylan3/800/1000',
      'https://picsum.photos/seed/dylan4/800/1000',
    ],
  },
  {
    email: 'ella@example.com',
    name: 'Ella Rodriguez',
    age: 25,
    bio: 'Barista and coffee connoisseur. Perfecting latte art and exploring coffee culture worldwide.',
    gender: Gender.FEMALE,
    location: 'Seattle, WA',
    interests: ['Coffee', 'Art', 'Travel', 'Food'],
    hobbies: ['Coffee Making', 'Latte Art', 'Café Visits'],
    lookingFor: 'Coffee date enthusiast',
    relationshipType: RelationshipType.CASUAL,
    genderPreference: GenderPreference.MALE,
    photos: [
      'https://picsum.photos/seed/ella1/800/1000',
      'https://picsum.photos/seed/ella2/800/1000',
      'https://picsum.photos/seed/ella3/800/1000',
    ],
  },
  {
    email: 'felix@example.com',
    name: 'Felix Wright',
    age: 31,
    bio: 'Cybersecurity expert protecting digital worlds. Tech geek, chess player, and problem solver.',
    gender: Gender.MALE,
    location: 'Boston, MA',
    interests: ['Cybersecurity', 'Technology', 'Chess', 'Gaming'],
    hobbies: ['Coding', 'Playing Chess', 'CTF Challenges'],
    lookingFor: 'Intelligent mind for deep conversations',
    relationshipType: RelationshipType.SERIOUS,
    genderPreference: GenderPreference.FEMALE,
    photos: [
      'https://picsum.photos/seed/felix1/800/1000',
      'https://picsum.photos/seed/felix2/800/1000',
    ],
  },
  {
    email: 'gina@example.com',
    name: 'Gina Thompson',
    age: 28,
    bio: 'Event planner making dreams come true. Love organizing parties, weddings, and unforgettable experiences.',
    gender: Gender.FEMALE,
    location: 'Chicago, IL',
    interests: ['Event Planning', 'Design', 'Socializing', 'Travel'],
    hobbies: ['Planning', 'Decorating', 'Networking'],
    lookingFor: 'Social partner who loves celebrations',
    relationshipType: RelationshipType.NOT_SURE,
    genderPreference: GenderPreference.MALE,
    photos: [
      'https://picsum.photos/seed/gina1/800/1000',
      'https://picsum.photos/seed/gina2/800/1000',
      'https://picsum.photos/seed/gina3/800/1000',
    ],
  },
  {
    email: 'hector@example.com',
    name: 'Hector Ramirez',
    age: 30,
    bio: 'Physical therapist helping people recover and thrive. Fitness lover and sports enthusiast.',
    gender: Gender.MALE,
    location: 'Phoenix, AZ',
    interests: ['Health', 'Fitness', 'Sports', 'Wellness'],
    hobbies: ['Working Out', 'Sports', 'Hiking'],
    lookingFor: 'Active partner who values health',
    relationshipType: RelationshipType.SERIOUS,
    genderPreference: GenderPreference.FEMALE,
    photos: [
      'https://picsum.photos/seed/hector1/800/1000',
      'https://picsum.photos/seed/hector2/800/1000',
      'https://picsum.photos/seed/hector3/800/1000',
      'https://picsum.photos/seed/hector4/800/1000',
    ],
  },
  {
    email: 'iris@example.com',
    name: 'Iris Chen',
    age: 24,
    bio: 'Aspiring filmmaker telling stories through the lens. Love indie films, cinematography, and storytelling.',
    gender: Gender.FEMALE,
    location: 'Los Angeles, CA',
    interests: ['Film', 'Photography', 'Storytelling', 'Art'],
    hobbies: ['Filmmaking', 'Watching Movies', 'Writing'],
    lookingFor: 'Creative soul who loves cinema',
    relationshipType: RelationshipType.CASUAL,
    genderPreference: GenderPreference.EVERYONE,
    photos: [
      'https://picsum.photos/seed/iris1/800/1000',
      'https://picsum.photos/seed/iris2/800/1000',
      'https://picsum.photos/seed/iris3/800/1000',
    ],
  },
  {
    email: 'jason@example.com',
    name: 'Jason Bell',
    age: 33,
    bio: 'Financial advisor helping people secure their future. Love investing, economics, and smart decisions.',
    gender: Gender.MALE,
    location: 'New York, NY',
    interests: ['Finance', 'Investing', 'Business', 'Travel'],
    hobbies: ['Reading', 'Investing', 'Golf'],
    lookingFor: 'Financially savvy partner',
    relationshipType: RelationshipType.SERIOUS,
    genderPreference: GenderPreference.FEMALE,
    photos: [
      'https://picsum.photos/seed/jason1/800/1000',
      'https://picsum.photos/seed/jason2/800/1000',
      'https://picsum.photos/seed/jason3/800/1000',
    ],
  },
  {
    email: 'kendra@example.com',
    name: 'Kendra Adams',
    age: 27,
    bio: 'Fitness influencer inspiring healthy lifestyles. Love HIIT, yoga, and green smoothies!',
    gender: Gender.FEMALE,
    location: 'Austin, TX',
    interests: ['Fitness', 'Health', 'Social Media', 'Wellness'],
    hobbies: ['Working Out', 'Content Creation', 'Yoga'],
    lookingFor: 'Gym buddy and life partner',
    relationshipType: RelationshipType.CASUAL,
    genderPreference: GenderPreference.MALE,
    photos: [
      'https://picsum.photos/seed/kendra1/800/1000',
      'https://picsum.photos/seed/kendra2/800/1000',
      'https://picsum.photos/seed/kendra3/800/1000',
      'https://picsum.photos/seed/kendra4/800/1000',
    ],
  },
  {
    email: 'leo@example.com',
    name: 'Leo Martinez',
    age: 29,
    bio: 'Sommelier and wine expert. Exploring vineyards and discovering the perfect pairings.',
    gender: Gender.MALE,
    location: 'Napa Valley, CA',
    interests: ['Wine', 'Food', 'Travel', 'Culture'],
    hobbies: ['Wine Tasting', 'Cooking', 'Traveling'],
    lookingFor: 'Wine lover for tastings and travels',
    relationshipType: RelationshipType.NOT_SURE,
    genderPreference: GenderPreference.FEMALE,
    photos: [
      'https://picsum.photos/seed/leo1/800/1000',
      'https://picsum.photos/seed/leo2/800/1000',
    ],
  },
  {
    email: 'mia@example.com',
    name: 'Mia Sullivan',
    age: 26,
    bio: 'Podcaster discussing pop culture and society. Love good conversations and sharing stories.',
    gender: Gender.FEMALE,
    location: 'Brooklyn, NY',
    interests: ['Podcasting', 'Media', 'Culture', 'Writing'],
    hobbies: ['Recording', 'Writing', 'Reading'],
    lookingFor: 'Great conversationalist',
    relationshipType: RelationshipType.CASUAL,
    genderPreference: GenderPreference.MALE,
    photos: [
      'https://picsum.photos/seed/mia1/800/1000',
      'https://picsum.photos/seed/mia2/800/1000',
      'https://picsum.photos/seed/mia3/800/1000',
    ],
  },
  {
    email: 'nolan@example.com',
    name: 'Nolan Price',
    age: 34,
    bio: 'Mechanical engineer and car enthusiast. Building custom cars and pushing engineering limits.',
    gender: Gender.MALE,
    location: 'Detroit, MI',
    interests: ['Engineering', 'Cars', 'Technology', 'Racing'],
    hobbies: ['Car Restoration', 'Racing', 'Mechanics'],
    lookingFor: 'Car enthusiast or curious mind',
    relationshipType: RelationshipType.SERIOUS,
    genderPreference: GenderPreference.FEMALE,
    photos: [
      'https://picsum.photos/seed/nolan1/800/1000',
      'https://picsum.photos/seed/nolan2/800/1000',
      'https://picsum.photos/seed/nolan3/800/1000',
      'https://picsum.photos/seed/nolan4/800/1000',
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

  // Create some mutual matches
  const matches = [
    [0, 1],   // Maricel & Alex (test account)
    [0, 3],   // Maricel & Bob
    [0, 4],   // Maricel & Charlie
    [0, 9],   // Maricel & Henry
    [2, 3],   // Alice & Bob
    [5, 7],   // Diana & Frank
    [6, 4],   // Emma & Charlie
    [8, 9],   // Grace & Henry
    [10, 11], // Isabel & Jack
    [12, 13], // Kate & Liam
    [14, 17], // Maya & Peter
    [19, 20], // Rachel & Sam
    [22, 23], // Uma & Victor
    [25, 26], // Xavier & Yara
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

  // Create some non-mutual likes
  const nonMutualLikes = [
    [15, 16], // Noah likes Olivia
    [18, 19], // Quinn likes Rachel
    [21, 22], // Tina likes Uma
    [24, 25], // Wendy likes Xavier
    [27, 28], // Amber likes Blake
    [29, 30], // Chloe likes Dylan
    [31, 32], // Ella likes Felix
    [33, 34], // Gina likes Hector
    [35, 36], // Iris likes Jason
    [37, 38], // Kendra likes Leo
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

  // Create some passes
  const passes = [
    [16, 17], // Olivia passes Peter
    [20, 21], // Sam passes Tina
    [23, 24], // Victor passes Wendy
    [28, 29], // Blake passes Chloe
    [32, 33], // Felix passes Gina
    [36, 37], // Jason passes Kendra
    [39, 40], // Mia passes Nolan
  ]

  for (const [idx1, idx2] of passes) {
    await prisma.like.create({
      data: {
        userId: createdUsers[idx1].user.id,
        targetUserId: createdUsers[idx2].user.id,
        action: LikeAction.PASS,
      },
    })
  }

  console.log('Creating messages...')

  // Create messages for first 3 matches
  for (let i = 0; i < Math.min(3, matchRecords.length); i++) {
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
  console.log(`Created ${passes.length} passes`)
  console.log('\nTest credentials (all users have the same password):')
  console.log('Password: password123')
  console.log('\nYour accounts:')
  console.log('- montuyamaricela@gmail.com (Maricel Montuya) - 4 matches')
  console.log('- montuyamaricela+test@gmail.com (Alex Thompson) - 1 match')
  console.log('\nOther sample users:')
  console.log('- alice@example.com')
  console.log('- bob@example.com')
  console.log('- charlie@example.com')
  console.log('- diana@example.com')
  console.log(`And ${users.length - 6} more...`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
