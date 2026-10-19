import { ArchiveIcon, BotIcon, FileCogIcon, RefreshCwIcon } from "lucide-react";
import { useState, type ReactNode } from "react";

import type { Credential, CredentialComponent, CredentialPlatformEntry } from "@/api/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { isArchived } from "@/lib/credential-revisions";
import { platformEntryOf } from "@/lib/credential-platforms";
import { CheckStatusBadge } from "../../components/check-status-badge";
import { MetadataSheet } from "../../components/metadata-sheet";
import { RotateSheet } from "../../components/rotate-sheet";
import { VerifyButton } from "../../components/verify-button";
import type { CredentialCheck } from "../../use-credential-check";
import { useCredentialPlatforms } from "../../use-credential-platforms";
import { useCredentialRotate } from "../../use-credential-rotate";
import { useMetadataEdit } from "../../use-metadata-edit";
import { useAgentEnable, type AgentEnableState } from "../use-agent-enable";
import { useCredentialArchive } from "../use-credential-archive";
import { useDetailCheck } from "../use-detail-check";
import { useRevisionRevoke } from "../use-revision-revoke";
import { AgentEnableSheet } from "./agent-enable-sheet";
import { ArchiveDialog } from "./archive-dialog";
import { RevisionList } from "./revision-list";
import { RevokeDialog } from "./revoke-dialog";

interface HealthSectionProps {
  readonly entry: CredentialPlatformEntry | null;
  readonly check: CredentialCheck;
}

function HealthSection({ entry, check }: HealthSectionProps) {
  return (
    <Card>
      <CardHeader className="flex flex-col items-start gap-2 md:flex-row md:items-center md:justify-between">
        <h3 className="font-semibold leading-none">Health</h3>
        <VerifyButton
          platform={entry?.platform ?? ""}
          verifiable={entry?.verifiable ?? true}
          checking={check.checking}
          onVerify={check.verify}
        />
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">
          Verify checks this credential against its platform. Custody makes no remote call at create
          or rotate.
        </p>
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-sm">
          <dt className="text-muted-foreground">Capability</dt>
          <dd className="min-w-0 break-words">{check.capability}</dd>
          <dt className="text-muted-foreground">Checked</dt>
          <dd className="min-w-0 break-words tabular-nums">{check.checkedAt}</dd>
        </dl>
      </CardContent>
    </Card>
  );
}

function EnableAgentsLabel() {
  return (
    <>
      <BotIcon aria-hidden="true" data-icon="inline-start" />
      Enable agents
    </>
  );
}

function EnableAgentsButton({ enable }: { enable: AgentEnableState }) {
  const [open, setOpen] = useState(false);

  if (enable.blocked === null) {
    return (
      <Button
        variant="outline"
        size="sm"
        disabled={enable.agentNames.length === 0}
        onClick={enable.start}
      >
        <EnableAgentsLabel />
      </Button>
    );
  }

  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            disabled
            focusableWhenDisabled
            className="data-disabled:opacity-50"
          />
        }
        onPointerUp={() => setOpen(true)}
      >
        <EnableAgentsLabel />
      </TooltipTrigger>
      <TooltipContent>{enable.blocked}</TooltipContent>
    </Tooltip>
  );
}

interface AgentsSectionProps {
  readonly credential: Credential;
  readonly reload: () => void;
}

function AgentsSection({ credential, reload }: AgentsSectionProps) {
  const enable = useAgentEnable(credential, reload);
  return (
    <Card>
      <CardHeader className="flex flex-col items-start gap-2 md:flex-row md:items-center md:justify-between">
        <h3 className="font-semibold leading-none">Agents</h3>
        <EnableAgentsButton enable={enable} />
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">
          An agent provider joins an LLM credential and a model to an agent. Enable agents gives
          each agent that is not enabled an agent provider for this credential.
        </p>
        {enable.agentNames.length > 0 && (
          <p className="text-sm">Not enabled: {enable.agentNames.join(", ")}</p>
        )}
        {enable.blocked !== null && <p className="text-sm">{enable.blocked}</p>}
        {enable.agentsError !== null && (
          <p role="alert" className="text-sm text-destructive">
            {enable.agentsError}
          </p>
        )}
      </CardContent>
      <AgentEnableSheet name={credential.name} enable={enable} />
    </Card>
  );
}

interface CredentialDetailProps {
  readonly component: CredentialComponent;
  readonly credential: Credential;
  readonly reload: () => void;
  readonly children?: ReactNode;
}

export function CredentialDetail({
  component,
  credential,
  reload,
  children,
}: CredentialDetailProps) {
  const entry = platformEntryOf(useCredentialPlatforms(component).data, credential.platform);
  const rotate = useCredentialRotate(component, credential, entry, reload);
  const metadata = useMetadataEdit(component, credential, entry, reload);
  const revoke = useRevisionRevoke(component, credential, reload);
  const archive = useCredentialArchive(component, credential);
  const archived = isArchived(credential);
  const check = useDetailCheck(component, credential.name);

  return (
    <div className="flex flex-col gap-4">
      <section aria-label="Credential" className="flex flex-col gap-2 border-b pb-3">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h2 className="min-w-0 font-mono text-lg font-semibold break-all">{credential.name}</h2>
            <Badge variant="outline">{credential.platform}</Badge>
            {archived && <Badge variant="secondary">Archived</Badge>}
            <CheckStatusBadge badge={check.badge} />
          </div>
          <div className="flex flex-wrap gap-2 md:justify-end">
            {!archived && rotate.available && (
              <Button variant="outline" size="sm" onClick={rotate.start}>
                <RefreshCwIcon aria-hidden="true" data-icon="inline-start" />
                Rotate secret
              </Button>
            )}
            {!archived && metadata.available && (
              <Button variant="outline" size="sm" onClick={metadata.start}>
                <FileCogIcon aria-hidden="true" data-icon="inline-start" />
                Edit metadata
              </Button>
            )}
            {!archived && (
              <Button variant="outline" size="sm" onClick={archive.request}>
                <ArchiveIcon aria-hidden="true" data-icon="inline-start" />
                Archive
              </Button>
            )}
          </div>
        </div>
      </section>
      {!archived && <HealthSection entry={entry} check={check} />}
      {!archived && component === "llm" && (
        <AgentsSection credential={credential} reload={reload} />
      )}
      <section aria-labelledby="credential-revisions" className="flex flex-col gap-2">
        <h3 id="credential-revisions" className="font-semibold">
          Revisions
        </h3>
        <RevisionList
          credential={credential}
          canRevoke={revoke.canRevoke}
          onRevoke={revoke.request}
        />
      </section>
      {children}
      {entry !== null && <RotateSheet name={credential.name} entry={entry} rotate={rotate} />}
      {entry !== null && <MetadataSheet name={credential.name} entry={entry} edit={metadata} />}
      <RevokeDialog revoke={revoke} />
      <ArchiveDialog name={credential.name} archive={archive} />
    </div>
  );
}
