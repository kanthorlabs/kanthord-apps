import { RecordName } from "@/components/record-name";
import type { ViolationText } from "@/lib/mission-violation";

interface ViolationLineProps {
  readonly filename: string | null;
  readonly text: ViolationText;
}

function CurrentBindings({ names }: { names: readonly string[] }) {
  if (names.length === 0) return <>The project has no bindings.</>;
  return (
    <>
      Current bindings:{" "}
      {names.map((name, index) => (
        <span key={name}>
          {index > 0 && ", "}
          <RecordName>{name}</RecordName>
        </span>
      ))}
      .
    </>
  );
}

export function ViolationLine({ filename, text }: ViolationLineProps) {
  return (
    <>
      {filename !== null && `${filename}: `}
      {text.kind === "message" ? (
        text.message
      ) : (
        <>
          No binding named <RecordName>{text.binding}</RecordName>.{" "}
          <CurrentBindings names={text.current} />
        </>
      )}
    </>
  );
}
