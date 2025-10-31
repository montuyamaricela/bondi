import Link from 'next/link';
import Image from 'next/image';
import { LandingNav } from '@/app/components/features/layout/components/LandingNav';

const steps = [
  {
    number: 1,
    title: 'Create Your Profile',
    description:
      'Share your interests, hobbies, and what makes you unique. Add photos that showcase your personality.',
  },
  {
    number: 2,
    title: 'Discover Matches',
    description:
      "Browse profiles tailored to your preferences. Swipe right on people you're interested in, or left to pass.",
  },
  {
    number: 3,
    title: 'Make Connections',
    description:
      "When you both like each other, it's a match! Start chatting and get to know each other better.",
  },
  {
    number: 4,
    title: 'Meet in Person',
    description:
      'Take your connection offline. Plan a date and see where the chemistry leads you.',
  },
];

export default function Home() {
  return (
    <div className='min-h-screen bg-white'>
      {/* Header */}
      <LandingNav />

      {/* Hero Section */}
      <section id='hero' className='relative h-screen bg-bg-main'>
        <div className='absolute inset-0'>
          <Image
            src='/images/landing/hero-image.png'
            alt='Two people lying down and laughing together'
            fill
            className='object-cover'
            priority
          />
          <div className='absolute inset-0 bg-black/40 dark:bg-bg-main/60' />
        </div>
        <div className='relative z-10 flex h-full flex-col justify-end pb-16 lg:pb-32'>
          <div className='container mx-auto px-4 sm:px-6 lg:px-8'>
            <h1 className="font-heading text-3xl font-semibold text-white md:text-5xl lg:text-6xl">
              Find your perfect match,
              <br />
              one swipe at a time
            </h1>
          </div>
        </div>
      </section>

      {/* Our Approach Section */}
      <section id='mission' className='bg-white py-16 lg:py-20'>
        <div className='container mx-auto px-4 sm:px-6 lg:px-8'>
          <div>
            <div className='flex flex-col gap-8 lg:flex-row lg:gap-8'>
              <div className='w-full flex flex-col gap-5'>
                <div>
                  <p className="mb-2 font-sans text-lg font-medium text-primary-main">
                    Our Approach
                  </p>
                  <div className='mb-5'>
                    <h2 className="font-heading text-3xl font-normal text-gray-900 md:text-4xl lg:text-7xl">
                      Go on your last <br /> first date.
                    </h2>
                  </div>
                </div>
                <div className=' max-w-lg ml-auto'>
                  <p className="font-sans text-lg leading-relaxed text-gray-700 mb-5">
                    Bondi is built on the belief that meaningful connections
                    start with authentic conversations. Our smart matching
                    algorithm connects you with compatible people based on your
                    interests, values, and what you&apos;re looking for in a
                    relationship.
                  </p>
                  <button className="font-sans w-fit rounded-full bg-bg-main px-8 py-3 text-base font-bold text-white transition-colors hover:bg-primary-main">
                    How we do it
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* About Us Section */}
      <section id='about' className='bg-bg-main py-16 lg:py-20'>
        <div className='container mx-auto px-4 sm:px-6 lg:px-8'>
          <div>
            <p className="font-sans text-lg font-medium text-secondary-text">
              About Us
            </p>
          </div>
          <div className=''>
            <div className='flex flex-col gap-7 lg:gap-7'>
              <div className='max-w-7xl'>
                <h2 className="mb-7 font-heading text-3xl font-semibold text-white md:text-4xl lg:text-5xl lg:mb-7">
                  Bondi: Where Bonding Begins
                </h2>
                <p className="mb-7 font-sans text-lg font-medium text-white lg:mb-7">
                  The name Bondi is short for &quot;bonding&quot; — because we
                  believe that genuine connections are built on authentic bonds,
                  not just swipes. We created Bondi to be more than just another
                  dating app; it&apos;s a platform designed to foster meaningful
                  relationships through smart matching, genuine conversations,
                  and shared interests.
                </p>
                <p className="font-sans text-lg font-medium text-secondary-text">
                  Every great relationship starts with a bond. Start yours
                  today.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Smart Matching Section */}
      <section id='labs' className='relative bg-white py-16 lg:py-20'>
        <div className='px-4 sm:px-6 lg:px-8'>
          <div className='relative flex items-center justify-center gap-30'>
            <div className='w-full max-w-lg'>
              <Image
                src='/images/landing/hinge-labs-image.png'
                alt='Couple laughing with each other'
                width={784}
                height={580}
                className='h-full w-full object-cover'
              />
            </div>
            <div className='mb-8 max-w-full lg:mb-8'>
              <p className="mb-8 font-sans text-lg font-medium text-primary-main lg:mb-8">
                Smart Matching
              </p>
              <div className='mb-7 lg:mb-7'>
                <h2 className="mb-1 font-heading text-3xl font-normal text-gray-900 md:text-4xl lg:text-5xl">
                  We understand compatibility.
                </h2>
              </div>
              <p className="font-sans text-base leading-relaxed text-gray-700">
                Our intelligent matching system learns from your preferences and
                interactions to connect you with people who share your interests
                and values. The more you use Bondi, the better your matches
                become.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id='how-it-works' className='bg-white py-16 lg:py-20'>
        <div className='container mx-auto px-4 sm:px-6 lg:px-8'>
          <div className='flex flex-col gap-16 lg:flex-row lg:gap-20'>
            <div className='w-full lg:max-w-md'>
              <p className="mb-8 font-sans text-lg font-medium text-primary-main">
                How It Works
              </p>
              <div className='mb-7'>
                <h1 className="font-heading text-4xl font-semibold leading-tight text-gray-900 md:text-5xl lg:text-6xl">
                  Start your
                  <br />
                  journey
                  <br />
                  today
                </h1>
              </div>
              <p className="mb-10 font-sans text-base leading-relaxed text-gray-700">
                Getting started is easy. Create your profile, discover
                compatible matches, and start meaningful conversations. Your
                next great connection is just a swipe away.
              </p>
              <Link href='/signup'>
                <button className="font-sans rounded-full bg-bg-main px-8 py-3 text-base font-bold text-white transition-colors hover:bg-primary-main">
                  Get started
                </button>
              </Link>
            </div>
            <div className='w-full flex-1'>
              <div className='grid grid-cols-1 gap-12 md:grid-cols-2 lg:gap-16'>
                {steps.map((step) => (
                  <div key={step.number} className='flex flex-col gap-5'>
                    <div className='flex h-14 w-14 items-center justify-center rounded-full bg-primary-main'>
                      <span className="font-sans text-2xl font-bold text-primary-text">
                        {step.number}
                      </span>
                    </div>
                    <h3 className="font-heading text-2xl font-semibold text-gray-900">
                      {step.title}
                    </h3>
                    <p className="font-sans text-base leading-relaxed text-gray-600">
                      {step.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className='bg-bg-main py-16 lg:py-24'>
        <div className='container mx-auto px-4 sm:px-6 lg:px-8'>
          <div className='mb-16 flex flex-wrap gap-8 lg:mb-72 lg:gap-8'>
            <div className='flex w-full min-w-[213px] flex-col lg:w-auto'>
              <div className='mb-16 flex flex-col items-start gap-4 lg:mb-72 lg:flex-row lg:items-center lg:justify-between'>
                <div className='flex flex-col items-start gap-4 lg:flex-row lg:items-center lg:gap-6'>
                  <div className='h-9 w-24 rounded bg-purple-600/20' />
                  <div className="font-sans text-sm text-[#A3A3A3]">
                    © 2025 Bondi Inc.
                  </div>
                  <div className='flex items-center gap-0 rounded px-4 py-0'>
                    <span className="font-sans text-base font-bold text-white">
                      English (US)
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className='flex min-w-[213px] flex-col'>
              <p className="mb-9 font-sans text-base text-[#A3A3A3]">
                Index
              </p>
              <nav className='flex flex-col gap-0'>
                <Link
                  href='#mission'
                  className="mb-2 font-sans px-4 py-2 text-base font-bold text-white transition-colors hover:text-purple-400"
                >
                  Mission
                </Link>
                <Link
                  href='#careers'
                  className="mb-2 font-sans px-4 py-2 text-base font-bold text-white transition-colors hover:text-purple-400"
                >
                  Careers
                </Link>
                <Link
                  href='#labs'
                  className="mb-2 font-sans px-4 py-2 text-base font-bold text-white transition-colors hover:text-purple-400"
                >
                  Labs
                </Link>
                <Link
                  href='#newsroom'
                  className="mb-2 font-sans px-4 py-2 text-base font-bold text-white transition-colors hover:text-purple-400"
                >
                  Newsroom
                </Link>
                <Link
                  href='#success-stories'
                  className="mb-2 font-sans px-4 py-2 text-base font-bold text-white transition-colors hover:text-purple-400"
                >
                  Success Stories
                </Link>
                <Link
                  href='#history'
                  className="mb-2 font-sans px-4 py-2 text-base font-bold text-white transition-colors hover:text-purple-400"
                >
                  History
                </Link>
                <Link
                  href='#contact'
                  className="mb-2 font-sans px-4 py-2 text-base font-bold text-white transition-colors hover:text-purple-400"
                >
                  Contact
                </Link>
              </nav>
            </div>
            <div className='flex min-w-[213px] flex-col'>
              <p className="mb-9 font-sans text-base text-[#A3A3A3]">
                Resources
              </p>
              <nav className='flex flex-col gap-0'>
                <Link
                  href='#safe-dating'
                  className="mb-2 font-sans px-4 py-2 text-base font-bold text-white transition-colors hover:text-purple-400"
                >
                  Safe Dating Tips
                </Link>
                <Link
                  href='#faq'
                  className="mb-2 font-sans px-4 py-2 text-base font-bold text-white transition-colors hover:text-purple-400"
                >
                  FAQ
                </Link>
                <Link
                  href='#trust-safety'
                  className="mb-2 font-sans px-4 py-2 text-base font-bold text-white transition-colors hover:text-purple-400"
                >
                  Trust & Safety
                </Link>
                <Link
                  href='#press-resources'
                  className="mb-2 font-sans px-4 py-2 text-base font-bold text-white transition-colors hover:text-purple-400"
                >
                  Press Resources
                </Link>
              </nav>
            </div>
            <div className='flex min-w-[213px] flex-col'>
              <p className="mb-9 font-sans text-base text-[#A3A3A3]">
                Legal
              </p>
              <nav className='flex flex-col gap-0'>
                <Link
                  href='#security'
                  className="mb-2 font-sans px-4 py-2 text-base font-bold text-white transition-colors hover:text-purple-400"
                >
                  Security
                </Link>
                <Link
                  href='#terms'
                  className="mb-2 font-sans px-4 py-2 text-base font-bold text-white transition-colors hover:text-purple-400"
                >
                  Terms
                </Link>
                <Link
                  href='#privacy'
                  className="mb-2 font-sans px-4 py-2 text-base font-bold text-white transition-colors hover:text-purple-400"
                >
                  Privacy
                </Link>
                <Link
                  href='#cookie-policy'
                  className="mb-2 font-sans px-4 py-2 text-base font-bold text-white transition-colors hover:text-purple-400"
                >
                  Cookie Policy
                </Link>
                <Link
                  href='#consumer-health'
                  className="mb-2 font-sans px-4 py-2 text-base font-bold text-white transition-colors hover:text-purple-400"
                >
                  Consumer Health Data Privacy Policy
                </Link>
                <Link
                  href='#colorado-safety'
                  className="mb-2 font-sans px-4 py-2 text-base font-bold text-white transition-colors hover:text-purple-400"
                >
                  Colorado Safety Policy Information
                </Link>
                <Link
                  href='#accessibility'
                  className="mb-2 font-sans px-4 py-2 text-base font-bold text-white transition-colors hover:text-purple-400"
                >
                  Accessibility Statement
                </Link>
              </nav>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
