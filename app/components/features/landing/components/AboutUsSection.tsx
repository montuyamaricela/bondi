export function AboutUsSection() {
  return (
    <section id='about' className='dark:bg-bg-main py-16 lg:py-20'>
      <div className='container mx-auto px-4 sm:px-6 lg:px-8'>
        <div>
          <p className='font-sans text-lg font-medium text-secondary-text'>
            About Us
          </p>
        </div>
        <div className=''>
          <div className='flex flex-col gap-7 lg:gap-7'>
            <div className='max-w-7xl'>
              <h2 className='mb-7 font-heading text-3xl font-semibold text-text-body dark:text-text-heading md:text-4xl lg:text-5xl lg:mb-7'>
                Bondi: Where Bonding Begins
              </h2>
              <p className='mb-7 font-sans text-lg font-medium  dark:text-primary-text lg:mb-7'>
                The name Bondi is short for &quot;bonding&quot; — because we
                believe that genuine connections are built on authentic bonds,
                not just swipes. We created Bondi to be more than just another
                dating app; it&apos;s a platform designed to foster meaningful
                relationships through smart matching, genuine conversations, and
                shared interests.
              </p>
              <p className='font-sans text-lg font-medium text-secondary-text'>
                Every great relationship starts with a bond. Start yours today.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
