import Link from 'next/link';
import Image from 'next/image';
import { LandingNav } from '@/app/components/features/layout/components/LandingNav';

export default function Home() {
  return (
    <div className='min-h-screen bg-white'>
      {/* Header */}
      <LandingNav />

      {/* Hero Section */}
      <section id='hero' className='relative h-screen bg-[#1A1A1A]'>
        <div className='absolute inset-0'>
          <Image
            src='/images/landing/hero-image.png'
            alt='Two people lying down and laughing together'
            fill
            className='object-cover'
            priority
          />
          <div className='absolute inset-0 bg-[#1A1A1A]/60' />
        </div>
        <div className='relative z-10 flex h-full flex-col justify-end pb-16 lg:pb-32'>
          <div className='container mx-auto px-4 sm:px-6 lg:px-8'>
            <h1 className="font-['Inter'] text-3xl font-semibold text-white md:text-5xl lg:text-6xl">
              Find your perfect match,
              <br />
              one swipe at a time
            </h1>
          </div>
        </div>
      </section>

      {/* Our Approach Section */}
      <section id='mission' className='bg-white py-16 lg:py-32'>
        <div className='container mx-auto px-4 sm:px-6 lg:px-8'>
          <div className='max-w-4xl'>
            <div className='flex flex-col gap-8 lg:flex-row lg:gap-8'>
              <div className='w-full max-w-lg'>
                <p className="mb-8 font-['Space_Grotesk'] text-lg font-medium text-purple-600">
                  Our Approach
                </p>
                <div className='mb-7'>
                  <h2 className="font-['Inter'] text-3xl font-normal text-gray-900 md:text-4xl lg:text-5xl">
                    Go on your{' '}
                    <span className='relative inline-block'>
                      <span className='absolute -left-1.5 -top-1 text-purple-600'>
                        last
                      </span>
                      <span className='relative text-gray-900'>last</span>
                    </span>{' '}
                    first date.
                  </h2>
                </div>
                <div className='mb-7 max-w-lg'>
                  <p className="font-['Space_Grotesk'] text-base leading-relaxed text-gray-700">
                    Bondi is built on the belief that meaningful connections
                    start with authentic conversations. Our smart matching
                    algorithm connects you with compatible people based on your
                    interests, values, and what you&apos;re looking for in a
                    relationship.
                  </p>
                </div>
                <button className="font-['Space_Grotesk'] rounded-full bg-[#1A1A1A] px-8 py-5 text-base font-bold text-white transition-colors hover:bg-primary-main">
                  How we do it
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Smart Matching Section */}
      <section id='labs' className='relative bg-white py-16 lg:py-32'>
        <div className='container mx-auto px-4 sm:px-6 lg:px-8'>
          <div className='relative'>
            <div className='mb-8 max-w-full lg:mb-8 lg:max-w-lg lg:pl-96'>
              <p className="mb-8 font-['Space_Grotesk'] text-lg font-medium text-purple-600 lg:mb-8">
                Smart Matching
              </p>
              <div className='mb-7 lg:mb-7'>
                <h2 className="mb-1 font-['Inter'] text-3xl font-normal text-gray-900 md:text-4xl lg:text-5xl">
                  We understand compatibility.
                </h2>
              </div>
              <p className="font-['Space_Grotesk'] text-base leading-relaxed text-gray-700">
                Our intelligent matching system learns from your preferences and
                interactions to connect you with people who share your interests
                and values. The more you use Bondi, the better your matches
                become.
              </p>
            </div>
            <div className='absolute right-0 top-[-150px] hidden h-96 w-full max-w-2xl overflow-hidden rounded-lg lg:right-72 lg:top-[-218px] lg:block lg:h-[580px] lg:w-[784px]'>
              <Image
                src='/images/landing/hinge-labs-image.png'
                alt='Couple laughing with each other'
                width={784}
                height={580}
                className='h-full w-full object-cover'
              />
            </div>
          </div>
        </div>
      </section>

      {/* What Our Users Say Section */}
      <section id='impact' className='bg-[#1A1A1A] py-16 lg:py-32'>
        <div className='container mx-auto px-4 sm:px-6 lg:px-8'>
          <div className='mb-5 lg:mb-5'>
            <p className="font-['Space_Grotesk'] text-lg font-medium text-[#D9C9D7]">
              What Our Users Say
            </p>
          </div>
          <div className='mb-16 lg:mb-32'>
            <div className='flex flex-col gap-7 lg:gap-7'>
              <div className='h-9 w-9'>
                <div className='h-full w-full rounded bg-purple-600/20' />
              </div>
              <div className='max-w-screen-xl'>
                <p className="mb-7 font-['Space_Grotesk'] text-lg font-medium text-white lg:mb-7">
                  I was skeptical about dating apps, but Bondi was different.
                  The matches felt genuine and we had so much in common. We
                  connected on our first conversation and haven&apos;t stopped
                  talking since. We&apos;ve been together for over a year now!
                </p>
                <p className="font-['Space_Grotesk'] text-lg font-medium text-white">Sarah M.</p>
              </div>
            </div>
          </div>
          <div className='flex justify-center gap-2 lg:gap-2'>
            <div className='h-0.5 w-full max-w-md bg-[#484848]' />
            <div className='h-0.5 w-full max-w-md bg-[#484848]' />
            <div className='h-0.5 w-full max-w-md bg-[#484848]' />
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id='how-it-works' className='bg-white py-16 lg:py-32'>
        <div className='container mx-auto px-4 sm:px-6 lg:px-8'>
          <div className='flex flex-col gap-16 lg:flex-row lg:gap-20'>
            <div className='w-full lg:max-w-md'>
              <p className="mb-8 font-['Space_Grotesk'] text-lg font-medium text-purple-600">
                How It Works
              </p>
              <div className='mb-7'>
                <h1 className="font-['Inter'] text-4xl font-semibold leading-tight text-gray-900 md:text-5xl lg:text-6xl">
                  Start your
                  <br />
                  journey
                  <br />
                  today
                </h1>
              </div>
              <p className="mb-10 font-['Space_Grotesk'] text-base leading-relaxed text-gray-700">
                Getting started is easy. Create your profile, discover
                compatible matches, and start meaningful conversations. Your
                next great connection is just a swipe away.
              </p>
              <Link href='/signup'>
                <button className="font-['Space_Grotesk'] rounded-full bg-[#1A1A1A] px-8 py-5 text-base font-bold text-white transition-colors hover:bg-primary-main">
                  Get started
                </button>
              </Link>
            </div>
            <div className='w-full flex-1'>
              <div className='grid grid-cols-1 gap-12 md:grid-cols-2 lg:gap-16'>
                <div className='flex flex-col gap-5'>
                  <div className='flex h-14 w-14 items-center justify-center rounded-full bg-purple-100'>
                    <span className="font-['Space_Grotesk'] text-2xl font-bold text-purple-600">
                      1
                    </span>
                  </div>
                  <h3 className="font-['Inter'] text-2xl font-semibold text-gray-900">
                    Create Your Profile
                  </h3>
                  <p className="font-['Space_Grotesk'] text-base leading-relaxed text-gray-600">
                    Share your interests, hobbies, and what makes you unique.
                    Add photos that showcase your personality.
                  </p>
                </div>
                <div className='flex flex-col gap-5'>
                  <div className='flex h-14 w-14 items-center justify-center rounded-full bg-purple-100'>
                    <span className="font-['Space_Grotesk'] text-2xl font-bold text-purple-600">
                      2
                    </span>
                  </div>
                  <h3 className="font-['Inter'] text-2xl font-semibold text-gray-900">
                    Discover Matches
                  </h3>
                  <p className="font-['Space_Grotesk'] text-base leading-relaxed text-gray-600">
                    Browse profiles tailored to your preferences. Swipe right on
                    people you&apos;re interested in, or left to pass.
                  </p>
                </div>
                <div className='flex flex-col gap-5'>
                  <div className='flex h-14 w-14 items-center justify-center rounded-full bg-purple-100'>
                    <span className="font-['Space_Grotesk'] text-2xl font-bold text-purple-600">
                      3
                    </span>
                  </div>
                  <h3 className="font-['Inter'] text-2xl font-semibold text-gray-900">
                    Make Connections
                  </h3>
                  <p className="font-['Space_Grotesk'] text-base leading-relaxed text-gray-600">
                    When you both like each other, it&apos;s a match! Start
                    chatting and get to know each other better.
                  </p>
                </div>
                <div className='flex flex-col gap-5'>
                  <div className='flex h-14 w-14 items-center justify-center rounded-full bg-purple-100'>
                    <span className="font-['Space_Grotesk'] text-2xl font-bold text-purple-600">
                      4
                    </span>
                  </div>
                  <h3 className="font-['Inter'] text-2xl font-semibold text-gray-900">
                    Meet in Person
                  </h3>
                  <p className="font-['Space_Grotesk'] text-base leading-relaxed text-gray-600">
                    Take your connection offline. Plan a date and see where the
                    chemistry leads you.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Press Section */}
      <section
        id='newsroom'
        className='border-t border-[#484848] bg-[#1A1A1A] py-16 lg:py-28'
      >
        <div className='container mx-auto px-4 sm:px-6 lg:px-8'>
          <div className='flex flex-col gap-6 lg:gap-6'>
            <p className="font-['Space_Grotesk'] text-lg font-medium text-[#D9C9D7]">Press</p>
            <div className='flex flex-col gap-7 lg:gap-7'>
              <h2 className="font-['Inter'] text-3xl font-normal text-white md:text-4xl lg:text-5xl">
                Bondi in the news.
              </h2>
              <p className="font-['Space_Grotesk'] text-base leading-relaxed text-white">
                Stay up to date with our latest news, updates, and success
                stories.
              </p>
              <button className="font-['Space_Grotesk'] w-fit rounded-full bg-white px-8 py-5 text-base font-bold text-purple-600 transition-opacity hover:opacity-90">
                Visit our newsroom
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className='bg-[#1A1A1A] py-16 lg:py-24'>
        <div className='container mx-auto px-4 sm:px-6 lg:px-8'>
          <div className='mb-16 flex flex-wrap gap-8 lg:mb-72 lg:gap-8'>
            <div className='flex w-full min-w-[213px] flex-col lg:w-auto'>
              <div className='mb-16 flex flex-col items-start gap-4 lg:mb-72 lg:flex-row lg:items-center lg:justify-between'>
                <div className='flex flex-col items-start gap-4 lg:flex-row lg:items-center lg:gap-6'>
                  <div className='h-9 w-24 rounded bg-purple-600/20' />
                  <div className="font-['Space_Grotesk'] text-sm text-[#A3A3A3]">
                    © 2025 Bondi Inc.
                  </div>
                  <div className='flex items-center gap-0 rounded px-4 py-0'>
                    <span className="font-['Space_Grotesk'] text-base font-bold text-white">
                      English (US)
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className='flex min-w-[213px] flex-col'>
              <p className="mb-9 font-['Space_Grotesk'] text-base text-[#A3A3A3]">Index</p>
              <nav className='flex flex-col gap-0'>
                <Link
                  href='#mission'
                  className="mb-2 font-['Space_Grotesk'] px-4 py-2 text-base font-bold text-white transition-colors hover:text-purple-400"
                >
                  Mission
                </Link>
                <Link
                  href='#careers'
                  className="mb-2 font-['Space_Grotesk'] px-4 py-2 text-base font-bold text-white transition-colors hover:text-purple-400"
                >
                  Careers
                </Link>
                <Link
                  href='#labs'
                  className="mb-2 font-['Space_Grotesk'] px-4 py-2 text-base font-bold text-white transition-colors hover:text-purple-400"
                >
                  Labs
                </Link>
                <Link
                  href='#newsroom'
                  className="mb-2 font-['Space_Grotesk'] px-4 py-2 text-base font-bold text-white transition-colors hover:text-purple-400"
                >
                  Newsroom
                </Link>
                <Link
                  href='#success-stories'
                  className="mb-2 font-['Space_Grotesk'] px-4 py-2 text-base font-bold text-white transition-colors hover:text-purple-400"
                >
                  Success Stories
                </Link>
                <Link
                  href='#history'
                  className="mb-2 font-['Space_Grotesk'] px-4 py-2 text-base font-bold text-white transition-colors hover:text-purple-400"
                >
                  History
                </Link>
                <Link
                  href='#contact'
                  className="mb-2 font-['Space_Grotesk'] px-4 py-2 text-base font-bold text-white transition-colors hover:text-purple-400"
                >
                  Contact
                </Link>
              </nav>
            </div>
            <div className='flex min-w-[213px] flex-col'>
              <p className="mb-9 font-['Space_Grotesk'] text-base text-[#A3A3A3]">Resources</p>
              <nav className='flex flex-col gap-0'>
                <Link
                  href='#safe-dating'
                  className="mb-2 font-['Space_Grotesk'] px-4 py-2 text-base font-bold text-white transition-colors hover:text-purple-400"
                >
                  Safe Dating Tips
                </Link>
                <Link
                  href='#faq'
                  className="mb-2 font-['Space_Grotesk'] px-4 py-2 text-base font-bold text-white transition-colors hover:text-purple-400"
                >
                  FAQ
                </Link>
                <Link
                  href='#trust-safety'
                  className="mb-2 font-['Space_Grotesk'] px-4 py-2 text-base font-bold text-white transition-colors hover:text-purple-400"
                >
                  Trust & Safety
                </Link>
                <Link
                  href='#press-resources'
                  className="mb-2 font-['Space_Grotesk'] px-4 py-2 text-base font-bold text-white transition-colors hover:text-purple-400"
                >
                  Press Resources
                </Link>
              </nav>
            </div>
            <div className='flex min-w-[213px] flex-col'>
              <p className="mb-9 font-['Space_Grotesk'] text-base text-[#A3A3A3]">Legal</p>
              <nav className='flex flex-col gap-0'>
                <Link
                  href='#security'
                  className="mb-2 font-['Space_Grotesk'] px-4 py-2 text-base font-bold text-white transition-colors hover:text-purple-400"
                >
                  Security
                </Link>
                <Link
                  href='#terms'
                  className="mb-2 font-['Space_Grotesk'] px-4 py-2 text-base font-bold text-white transition-colors hover:text-purple-400"
                >
                  Terms
                </Link>
                <Link
                  href='#privacy'
                  className="mb-2 font-['Space_Grotesk'] px-4 py-2 text-base font-bold text-white transition-colors hover:text-purple-400"
                >
                  Privacy
                </Link>
                <Link
                  href='#cookie-policy'
                  className="mb-2 font-['Space_Grotesk'] px-4 py-2 text-base font-bold text-white transition-colors hover:text-purple-400"
                >
                  Cookie Policy
                </Link>
                <Link
                  href='#consumer-health'
                  className="mb-2 font-['Space_Grotesk'] px-4 py-2 text-base font-bold text-white transition-colors hover:text-purple-400"
                >
                  Consumer Health Data Privacy Policy
                </Link>
                <Link
                  href='#colorado-safety'
                  className="mb-2 font-['Space_Grotesk'] px-4 py-2 text-base font-bold text-white transition-colors hover:text-purple-400"
                >
                  Colorado Safety Policy Information
                </Link>
                <Link
                  href='#accessibility'
                  className="mb-2 font-['Space_Grotesk'] px-4 py-2 text-base font-bold text-white transition-colors hover:text-purple-400"
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
