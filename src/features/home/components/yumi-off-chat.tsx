import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Composer } from "@/features/workbench/chat/components/composer";
import { useComposer } from "@/features/workbench/chat/use-composer";
import { agentPath, YUMI_AGENT } from "@/lib/workbench-sessions";

interface YumiOffChatProps {
  readonly children: ReactNode;
}

const NO_SEND = () => Promise.resolve(false);
const NO_CHANGE = () => undefined;

export function YumiOffChat({ children }: YumiOffChatProps) {
  const composer = useComposer(true, NO_SEND, { agentName: YUMI_AGENT, onNew: NO_CHANGE });

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-4">
      <p className="text-sm">
        Yumi is not enabled.{" "}
        <Button
          variant="link"
          size="sm"
          nativeButton={false}
          render={<Link to={agentPath(YUMI_AGENT)} />}
        >
          Enable Yumi
        </Button>{" "}
        to chat here.
      </p>
      {children}
      <div className="sticky bottom-0 mt-auto bg-background pt-2">
        <Composer
          composer={composer}
          configuration={null}
          runActive={false}
          onStop={NO_CHANGE}
          placeholder="Enable Yumi to chat here."
          inputDisabled
        />
      </div>
    </div>
  );
}
