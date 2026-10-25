import type { ReactNode } from "react";

interface TouchTargetProps {
  readonly children: ReactNode;
}

export function TouchTarget({ children }: TouchTargetProps) {
  return <div className="contents [&>*]:min-h-11 lg:[&>*]:min-h-0">{children}</div>;
}
