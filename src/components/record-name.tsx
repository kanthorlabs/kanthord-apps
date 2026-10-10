import type { ReactNode } from "react";

interface RecordNameProps {
  readonly children: ReactNode;
}

export function RecordName({ children }: RecordNameProps) {
  return <strong className="font-semibold break-words">{children}</strong>;
}
