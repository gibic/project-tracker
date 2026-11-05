import { Skeleton } from '@/components/ui/skeleton'
import { LoadingStatus, PageHeaderSkeleton } from '@/features/shared/skeletons'

export default function ProjectLoading() {
  return (
    <>
      <LoadingStatus label="Loading project…" />
      <PageHeaderSkeleton actions={2} />
      <Skeleton className="mb-6 h-2 max-w-md rounded-full" aria-hidden />

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_18rem]" aria-hidden>
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-9 w-56" />
            <Skeleton className="h-9 w-36" />
            <Skeleton className="ml-auto h-9 w-40" />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {[3, 2, 1].map((cards, column) => (
              <div key={column} className="flex min-h-48 flex-col gap-2 rounded-lg border bg-card/60 p-3">
                <div className="flex items-center justify-between px-1 pb-1">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-3 w-4" />
                </div>
                {Array.from({ length: cards }, (_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-4 w-40" />
        </div>
      </div>
    </>
  )
}
