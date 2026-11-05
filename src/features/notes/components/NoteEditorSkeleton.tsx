import { Skeleton } from '@/components/ui/skeleton'
import { LoadingStatus, PageHeaderSkeleton } from '@/features/shared/skeletons'

/** Loading state for the new/edit note pages; mirrors the NoteEditor layout. */
export function NoteEditorSkeleton({ label }: { label: string }) {
  return (
    <>
      <LoadingStatus label={label} />
      <PageHeaderSkeleton description={false} />
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]" aria-hidden>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-96 w-full" />
          </div>
        </div>
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-9 w-full" />
          </div>
          {Array.from({ length: 2 }, (_, i) => (
            <div key={i} className="flex flex-col gap-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-32" />
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
