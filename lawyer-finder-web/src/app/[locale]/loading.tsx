import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Header skeleton */}
      <div className="h-16 border-b bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-6">
          <Skeleton className="h-9 w-36 rounded-xl" />
          <div className="flex gap-4">
            <Skeleton className="h-9 w-24 rounded-full" />
            <Skeleton className="h-9 w-24 rounded-full" />
            <Skeleton className="h-9 w-32 rounded-full" />
          </div>
        </div>
      </div>

      {/* Hero skeleton */}
      <div className="bg-[#0d1017] py-24 px-6">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-6">
          <Skeleton className="h-14 w-3/4 rounded-xl bg-white/10" />
          <Skeleton className="h-6 w-1/2 rounded-xl bg-white/10" />
          <Skeleton className="mt-4 h-14 w-full max-w-2xl rounded-2xl bg-white/10" />
        </div>
      </div>

      {/* Content skeleton */}
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex flex-col gap-4 rounded-2xl border border-neutral-100 p-8 bg-white">
              <Skeleton className="h-16 w-16 rounded-xl" />
              <Skeleton className="h-6 w-2/3 rounded-lg" />
              <Skeleton className="h-4 w-full rounded-lg" />
              <Skeleton className="h-4 w-4/5 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
