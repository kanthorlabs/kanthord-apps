import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";

interface AllClearProps {
  readonly titleRef: (element: HTMLElement | null) => void;
  readonly fault?: boolean;
  readonly workforce?: string;
}

export function AllClear({ titleRef, fault = false, workforce }: AllClearProps) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyTitle ref={titleRef} tabIndex={-1}>
          {fault ? "No act found" : "All clear"}
        </EmptyTitle>
        <EmptyDescription>
          {fault ? "Some records could not be read." : "No decision waits for you."}
        </EmptyDescription>
        {workforce !== undefined && <EmptyDescription>{workforce}</EmptyDescription>}
      </EmptyHeader>
    </Empty>
  );
}
