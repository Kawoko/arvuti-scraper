import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 pt-10 sm:px-6">
      <div className="space-y-5">
        <Skeleton className="h-7 w-56" />

        <Skeleton className="h-[4.75rem] w-full rounded-xl" />

        <Skeleton className="h-40 w-full rounded-xl" />

        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}
