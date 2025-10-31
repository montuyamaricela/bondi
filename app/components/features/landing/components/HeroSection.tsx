import Image from 'next/image';

export function HeroSection() {
  return (
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
          <h1 className='font-heading text-3xl font-semibold text-white md:text-5xl lg:text-6xl'>
            Find your perfect match,
            <br />
            one swipe at a time
          </h1>
        </div>
      </div>
    </section>
  );
}
