# Bondi

A modern dating application built with Next.js, featuring profile management, user discovery, real-time matching, and messaging.

## Features

- **User Authentication** - Secure email-based registration and login
- **Profile Management** - Create and customize profiles with photos, bio, and interests
- **User Discovery** - Browse and discover users through an intuitive swipeable interface
- **Smart Matching** - Automatic match creation on mutual likes
- **Real-time Messaging** - Chat with your matches instantly
- **Advanced Filters** - Filter by age range and location
- **Theme Support** - Light and dark mode with system preference detection
- **Push Notifications** - Get notified of new matches and messages

## Tech Stack

- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS v4
- **Authentication**: Better Auth
- **Database**: PostgreSQL with Prisma ORM
- **File Uploads**: UploadThing
- **Real-time**: Socket.IO
- **State Management**: React Query
- **Form Handling**: React Hook Form with Zod validation
- **UI Components**: shadcn/ui

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database

### Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   ```
   Fill in the required values in `.env`

4. Set up the database:
   ```bash
   npx prisma migrate dev
   npx prisma generate
   ```

5. Run the development server:
   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000)

## Development Commands

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm start            # Run production server
npm run lint         # Run ESLint

npx prisma studio    # Open database GUI
npx prisma migrate dev --name <name>  # Create new migration
npx prisma generate  # Regenerate Prisma client
```

## Project Structure

```
app/
├── (auth)/          # Authentication pages
├── (main)/          # Protected app pages
├── api/             # API routes
└── components/      # React components

lib/                 # Utilities and configurations
prisma/             # Database schema and migrations
```
