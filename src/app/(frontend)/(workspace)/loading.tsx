import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { CardSkeleton, LoadingStatus, PageHeaderSkeleton } from '@/features/shared/skeletons'

export default function DashboardLoading() {
  return (
    <>
      <LoadingStatus label="Loading dashboard…" />
      <PageHeaderSkeleton description={false} />

      <div className="mb-6 grid gap-4 sm:grid-cols-3" aria-hidden>
        {Array.from({ length: 3 }, (_, i) => (
          <Card key={i} className="flex flex-col gap-2 p-5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-9 w-12" />
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton lines={4} className="lg:col-span-2" />
        <CardSkeleton lines={4} />
      </div>
    </>
  )
}
