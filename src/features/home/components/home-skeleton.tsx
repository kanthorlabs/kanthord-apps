import { Skeleton } from "@/components/ui/skeleton";

const ROWS = ["w-full", "w-5/6", "w-2/3"] as const;

export function HomeSkeleton() {
  return (
    <div role="region" aria-label="Loading Home" className="flex flex-col gap-3">
      <span className="sr-only">Reading Home.</span>
      {ROWS.map((width) => (
        <Skeleton key={width} className={`h-12 ${width}`} />
      ))}
    </div>
  );
}
