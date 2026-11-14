export function OurApproachSection() {
  return (
    <section id="mission" className="bg-white py-16 lg:py-20">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div>
          <div className="flex flex-col gap-8 lg:flex-row lg:gap-8">
            <div className="flex w-full flex-col gap-5">
              <div>
                <p className="mb-2 font-sans text-lg font-medium text-primary-main">Our Approach</p>
                <div className="mb-5">
                  <h2 className="font-heading text-3xl font-normal text-gray-900 md:text-4xl lg:text-7xl">
                    Go on your last <br /> first date.
                  </h2>
                </div>
              </div>
              <div className="ml-auto max-w-lg">
                <p className="mb-5 font-sans text-lg leading-relaxed text-gray-700">
                  Bondi is built on the belief that meaningful connections start with authentic
                  conversations. Our smart matching algorithm connects you with compatible people
                  based on your interests, hobbies, and what you&apos;re looking for in a
                  relationship.
                </p>
                <a
                  href="#how-it-works"
                  className="inline-flex w-fit cursor-pointer rounded-full bg-black px-8 py-3 font-sans text-base font-bold text-white transition-colors hover:bg-primary-main focus-visible:ring-2 focus-visible:ring-primary-main focus-visible:ring-offset-4 dark:bg-bg-main dark:text-primary-text"
                >
                  How we do it
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
