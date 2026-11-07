interface AbsentSourcesNoteProps {
  readonly sources: readonly string[];
}

export function AbsentSourcesNote({ sources }: AbsentSourcesNoteProps) {
  return (
    <p className="text-sm text-muted-foreground break-words">
      Not available on this server: {sources.join(", ")}.
    </p>
  );
}
