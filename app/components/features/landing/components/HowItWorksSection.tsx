import Link from 'next/link';

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

export function HowItWorksSection() {
  return (
    <section id='how-it-works' className='bg-white py-16 lg:py-20'>
      <div className='container mx-auto px-4 sm:px-6 lg:px-8'>
        <div className='flex flex-col gap-16 lg:flex-row lg:gap-20'>
          <div className='w-full lg:max-w-md'>
            <p className='mb-8 font-sans text-lg font-medium text-primary-main'>
              How It Works
            </p>
            <div className='mb-7'>
              <h1 className='font-heading text-4xl font-semibold leading-tight text-gray-900 md:text-5xl lg:text-6xl'>
                Start your
                <br />
                journey
                <br />
                today
              </h1>
            </div>
            <p className='mb-10 font-sans text-base leading-relaxed text-gray-700'>
              Getting started is easy. Create your profile, discover compatible
              matches, and start meaningful conversations. Your next great
              connection is just a swipe away.
            </p>
            <Link href='/signup'>
              <button className='font-sans w-fit rounded-full bg-black px-8 py-3 text-base font-bold text-white transition-colors hover:bg-primary-main dark:bg-bg-main dark:text-primary-text cursor-pointer'>
                Get started
              </button>
            </Link>
          </div>
          <div className='w-full flex-1'>
            <div className='grid grid-cols-1 gap-12 md:grid-cols-2 lg:gap-16'>
              {steps.map((step) => (
                <div key={step.number} className='flex flex-col gap-5'>
                  <div className='flex h-14 w-14 items-center justify-center rounded-full bg-primary-main'>
                    <span className='font-sans text-2xl font-bold text-primary-text'>
                      {step.number}
                    </span>
                  </div>
                  <h3 className='font-heading text-2xl font-semibold text-gray-900'>
                    {step.title}
                  </h3>
                  <p className='font-sans text-base leading-relaxed text-gray-600'>
                    {step.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
