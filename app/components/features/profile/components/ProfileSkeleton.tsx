export function ProfileSkeleton() {
  return (
    <div className="min-h-screen bg-bg-main py-8">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between">
          <div className="h-9 w-48 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-10 w-32 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
        </div>

        <div className="flex gap-6">
          {/* Left Column */}
          <div className="flex-1 overflow-hidden rounded-lg border border-border-main bg-bg-card shadow-md">
            <div className="space-y-4 p-6">
              {/* Profile Image */}
              <div className="flex justify-center">
                <div className="h-48 w-48 animate-pulse rounded-full bg-gray-200 dark:bg-gray-700" />
              </div>

              {/* Profile Info */}
              <div className="space-y-2">
                <div className="mx-auto h-8 w-40 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                <div className="flex flex-col items-center space-y-1">
                  <div className="h-4 w-32 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                  <div className="h-4 w-24 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                </div>
              </div>

              {/* About Section */}
              <div className="space-y-2 border-t border-border-main pt-4">
                <div className="h-4 w-16 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                <div className="space-y-2">
                  <div className="h-4 w-full animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                  <div className="h-4 w-full animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                  <div className="h-4 w-3/4 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                </div>
              </div>

              {/* Preferences Section */}
              <div className="space-y-3 border-t border-border-main pt-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-start space-x-3">
                    <div className="mt-0.5 h-5 w-5 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                    <div className="flex-1 space-y-1">
                      <div className="h-4 w-24 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                      <div className="h-5 w-32 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="w-96 space-y-6 overflow-hidden rounded-lg border border-border-main bg-bg-card p-6 shadow-md">
            {/* Interests */}
            <div className="space-y-4">
              <div className="h-6 w-24 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
              <div className="flex flex-wrap gap-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className="h-7 w-20 animate-pulse rounded-full bg-gray-200 dark:bg-gray-700"
                  />
                ))}
              </div>
            </div>

            {/* Hobbies */}
            <div className="space-y-4">
              <div className="h-6 w-24 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
              <div className="flex flex-wrap gap-2">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="h-7 w-20 animate-pulse rounded-full bg-gray-200 dark:bg-gray-700"
                  />
                ))}
              </div>
            </div>

            {/* Photos */}
            <div className="space-y-4">
              <div className="h-6 w-24 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
              <div className="grid grid-cols-3 gap-4">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div
                    key={i}
                    className="aspect-square animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700"
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
