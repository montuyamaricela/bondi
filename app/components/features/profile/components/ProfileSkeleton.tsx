export function ProfileSkeleton() {
  return (
    <div className='min-h-screen bg-bg-main py-8'>
      <div className='container mx-auto px-4 sm:px-6 lg:px-8'>
        <div className='flex justify-between items-center mb-6'>
          <div className='h-9 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse' />
          <div className='h-10 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse' />
        </div>

        <div className='flex gap-6'>
          {/* Left Column */}
          <div className='bg-bg-card rounded-lg shadow-md overflow-hidden border border-border-main flex-1'>
            <div className='p-6 space-y-4'>
              {/* Profile Image */}
              <div className='flex justify-center'>
                <div className='w-48 h-48 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse' />
              </div>

              {/* Profile Info */}
              <div className='space-y-2'>
                <div className='h-8 w-40 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mx-auto' />
                <div className='flex flex-col items-center space-y-1'>
                  <div className='h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse' />
                  <div className='h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse' />
                </div>
              </div>

              {/* About Section */}
              <div className='border-t border-border-main pt-4 space-y-2'>
                <div className='h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse' />
                <div className='space-y-2'>
                  <div className='h-4 w-full bg-gray-200 dark:bg-gray-700 rounded animate-pulse' />
                  <div className='h-4 w-full bg-gray-200 dark:bg-gray-700 rounded animate-pulse' />
                  <div className='h-4 w-3/4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse' />
                </div>
              </div>

              {/* Preferences Section */}
              <div className='border-t border-border-main pt-4 space-y-3'>
                {[1, 2, 3].map((i) => (
                  <div key={i} className='flex items-start space-x-3'>
                    <div className='h-5 w-5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mt-0.5' />
                    <div className='space-y-1 flex-1'>
                      <div className='h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse' />
                      <div className='h-5 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse' />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className='bg-bg-card rounded-lg shadow-md overflow-hidden border border-border-main p-6 space-y-6 w-96'>
            {/* Interests */}
            <div className='space-y-4'>
              <div className='h-6 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse' />
              <div className='flex flex-wrap gap-2'>
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className='h-7 w-20 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse'
                  />
                ))}
              </div>
            </div>

            {/* Hobbies */}
            <div className='space-y-4'>
              <div className='h-6 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse' />
              <div className='flex flex-wrap gap-2'>
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className='h-7 w-20 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse'
                  />
                ))}
              </div>
            </div>

            {/* Photos */}
            <div className='space-y-4'>
              <div className='h-6 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse' />
              <div className='grid grid-cols-3 gap-4'>
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div
                    key={i}
                    className='aspect-square bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse'
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
