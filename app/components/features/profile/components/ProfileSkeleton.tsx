export function ProfileSkeleton() {
  return (
    <div className="min-h-screen bg-bg-main py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-6">
          <div className="h-9 w-48 bg-secondary-main rounded animate-pulse" />
          <div className="h-10 w-32 bg-secondary-main rounded animate-pulse" />
        </div>

        <div className="space-y-6">
          <div className="bg-bg-card rounded-lg shadow-md overflow-hidden border border-border-main">
            <div className="relative aspect-square w-full max-w-md mx-auto bg-secondary-main animate-pulse" />

            <div className="p-6 space-y-4">
              <div className="space-y-2">
                <div className="h-8 w-48 bg-secondary-main rounded animate-pulse" />
                <div className="h-5 w-32 bg-secondary-main rounded animate-pulse" />
              </div>

              <div className="space-y-2">
                <div className="h-4 w-16 bg-secondary-main rounded animate-pulse" />
                <div className="h-16 w-full bg-secondary-main rounded animate-pulse" />
              </div>

              <div className="space-y-2">
                <div className="h-4 w-20 bg-secondary-main rounded animate-pulse" />
                <div className="flex flex-wrap gap-2">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="h-7 w-20 bg-secondary-main rounded-full animate-pulse"
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <div className="h-4 w-20 bg-secondary-main rounded animate-pulse" />
                <div className="flex flex-wrap gap-2">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="h-7 w-20 bg-secondary-main rounded-full animate-pulse"
                    />
                  ))}
                </div>
              </div>

              <div className="border-t border-border-main pt-4 space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center space-x-3">
                    <div className="h-5 w-5 bg-secondary-main rounded animate-pulse" />
                    <div className="space-y-1 flex-1">
                      <div className="h-4 w-24 bg-secondary-main rounded animate-pulse" />
                      <div className="h-5 w-32 bg-secondary-main rounded animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
