export function OurApproachSection() {
  return (
    <section id='mission' className='bg-white py-16 lg:py-20'>
      <div className='container mx-auto px-4 sm:px-6 lg:px-8'>
        <div>
          <div className='flex flex-col gap-8 lg:flex-row lg:gap-8'>
            <div className='w-full flex flex-col gap-5'>
              <div>
                <p className='mb-2 font-sans text-lg font-medium text-primary-main'>
                  Our Approach
                </p>
                <div className='mb-5'>
                  <h2 className='font-heading text-3xl font-normal text-gray-900 md:text-4xl lg:text-7xl'>
                    Go on your last <br /> first date.
                  </h2>
                </div>
              </div>
              <div className=' max-w-lg ml-auto'>
                <p className='font-sans text-lg leading-relaxed text-gray-700 mb-5'>
                  Bondi is built on the belief that meaningful connections start
                  with authentic conversations. Our smart matching algorithm
                  connects you with compatible people based on your interests,
                  values, and what you&apos;re looking for in a relationship.
                </p>
                <button className='font-sans w-fit rounded-full bg-black px-8 py-3 text-base font-bold text-white transition-colors hover:bg-primary-main dark:bg-bg-main dark:text-primary-text cursor-pointer'>
                  How we do it
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
