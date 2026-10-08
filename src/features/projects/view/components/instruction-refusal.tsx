import { Link } from "react-router-dom";

import type { ApiError } from "@/api/errors";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

interface InstructionRefusalProps {
  readonly error: ApiError;
  readonly sshCredential: string;
  readonly onRetry: () => void;
}

export function InstructionRefusal({ error, sshCredential, onRetry }: InstructionRefusalProps) {
  return (
    <Alert variant="destructive">
      <AlertTitle>The instruction files were not read.</AlertTitle>
      <AlertDescription className="flex flex-col items-start gap-2">
        <span className="break-words">
          <code>{error.detail === "" ? error.code : error.detail}</code>: {error.message}
        </span>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>
            Retry
          </Button>
          <Button
            variant="outline"
            size="sm"
            render={
              <Link
                to={`/repositories/${encodeURIComponent(sshCredential)}`}
                target="_blank"
                rel="noreferrer"
              />
            }
            nativeButton={false}
          >
            Open SSH credential {sshCredential}
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
