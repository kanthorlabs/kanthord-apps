import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";

interface AllClearProps {
  readonly titleRef: (element: HTMLElement | null) => void;
}

export function AllClear({ titleRef }: AllClearProps) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyTitle ref={titleRef} tabIndex={-1}>
          All clear
        </EmptyTitle>
        <EmptyDescription>No decision waits for you.</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
