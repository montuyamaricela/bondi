import Image from 'next/image';

export function SmartMatchingSection() {
  return (
    <section id="labs" className="relative bg-white py-16 lg:py-20">
      <div className="px-4 sm:px-6 lg:px-0">
        <div className="relative grid grid-cols-1 items-center justify-center gap-10 lg:grid-cols-2">
          <div className="w-full">
            <Image
              src="/images/landing/hinge-labs-image.png"
              alt="Couple laughing with each other"
              width={784}
              height={580}
              className="h-full w-full object-cover"
            />
          </div>
          <div className="mb-8 max-w-full lg:mb-8">
            <p className="mb-8 font-sans text-lg font-medium text-primary-main lg:mb-8">
              Smart Matching
            </p>
            <div className="mb-7 lg:mb-7">
              <h2 className="mb-1 font-heading text-3xl font-normal text-gray-900 md:text-4xl lg:text-5xl">
                We understand compatibility.
              </h2>
            </div>
            <p className="font-sans text-base leading-relaxed text-gray-700">
              Your suggestions consider shared interests, hobbies, and relationship preferences. Set
              age and distance filters to narrow the profiles you discover.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
