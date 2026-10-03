import type { ReactNode } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import type { SettledRead } from "../settled-read";

interface RecordSectionProps<T> {
  readonly title: string;
  readonly read: SettledRead<T>;
  readonly children: (data: T) => ReactNode;
}

export function RecordSection<T>({ title, read, children }: RecordSectionProps<T>) {
  return (
    <section aria-label={title} className="flex flex-col gap-2">
      <h4 className="text-sm font-medium">{title}</h4>
      {read.error !== null ? (
        <Alert variant="destructive">
          <AlertDescription>{read.error.message}</AlertDescription>
        </Alert>
      ) : (
        children(read.data)
      )}
    </section>
  );
}
