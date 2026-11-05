import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { LoadingStatus, PageHeaderSkeleton } from '@/features/shared/skeletons'

export default function ProjectsLoading() {
  return (
    <>
      <LoadingStatus label="Loading projects…" />
      <PageHeaderSkeleton actions={1} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-hidden>
        {Array.from({ length: 6 }, (_, i) => (
          <Card key={i} className="flex flex-col gap-3 p-5">
            <div className="flex items-center gap-2">
              <Skeleton className="size-2.5 rounded-full" />
              <Skeleton className="h-5 w-32" />
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-2 w-full rounded-full" />
          </Card>
        ))}
      </div>
    </>
  )
}
