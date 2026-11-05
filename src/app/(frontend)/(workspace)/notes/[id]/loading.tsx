import { Skeleton } from '@/components/ui/skeleton'
import { LineSkeletons, LoadingStatus, PageHeaderSkeleton } from '@/features/shared/skeletons'

export default function NoteLoading() {
  return (
    <>
      <LoadingStatus label="Loading note…" />
      <PageHeaderSkeleton actions={2} />
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="flex flex-col gap-6">
          <LineSkeletons count={6} />
          <LineSkeletons count={4} />
        </div>
        <div className="flex flex-col gap-6" aria-hidden>
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="flex flex-col gap-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-4 w-40" />
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
