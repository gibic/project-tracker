import { Skeleton } from '@/components/ui/skeleton'
import { ListSkeleton, LoadingStatus, PageHeaderSkeleton } from '@/features/shared/skeletons'

export default function NotesLoading() {
  return (
    <>
      <LoadingStatus label="Loading notes…" />
      <PageHeaderSkeleton actions={1} />
      <div className="mb-4 flex max-w-md gap-2" aria-hidden>
        <Skeleton className="h-9 flex-1" />
        <Skeleton className="size-9" />
      </div>
      <div className="mb-6 flex flex-wrap gap-1.5" aria-hidden>
        {['w-14', 'w-20', 'w-16', 'w-12', 'w-24'].map((width) => (
          <Skeleton key={width} className={`h-5 ${width}`} />
        ))}
      </div>
      <ListSkeleton rows={8} />
    </>
  )
}
