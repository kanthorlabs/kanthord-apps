import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";

export function AllClear() {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyTitle tabIndex={-1}>All clear</EmptyTitle>
        <EmptyDescription>No decision waits for you.</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
