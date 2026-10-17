import { Fragment } from "react";

import { RecordName } from "@/components/record-name";
import type { TakerHint } from "@/lib/claim-takers";
import type {
  AgentInvalidItem,
  CredentialRefusedItem,
  FixAttentionItem,
  InvalidBinding,
  NoTakerItem,
  RequestRejectedItem,
} from "@/lib/fix-attention";

interface FixCauseTextProps {
  readonly item: FixAttentionItem;
}

function NoTakerSentence({ item }: { readonly item: NoTakerItem }) {
  const { hint, state, jobCount } = item;
  if (hint.kind === "none") {
    return (
      <>
        No worker binding matches the oldest job in state {state}. Add a binding whose worker and
        traits match it on the Bindings tab.
      </>
    );
  }
  return (
    <>
      {jobCount} {jobCount === 1 ? "job waits" : "jobs wait"} in state {state}. Binding{" "}
      <RecordName>{hint.binding}</RecordName> (<RecordName>{hint.worker}</RecordName>) matches the
      oldest job and <TakerSituation hint={hint} />
    </>
  );
}

function TakerSituation({ hint }: { readonly hint: Exclude<TakerHint, { kind: "none" }> }) {
  if (hint.kind === "server") {
    return <>runs no instance. Raise its instance_count, or check the server log.</>;
  }
  return <>has no live instance. Start its worker program.</>;
}

function CredentialNames({ names }: { readonly names: readonly string[] }) {
  return (
    <>
      {names.map((name, index) => (
        <Fragment key={name}>
          {index > 0 && ", "}
          <RecordName>{name}</RecordName>
        </Fragment>
      ))}
    </>
  );
}

function BindingPairs({ bindings }: { readonly bindings: readonly InvalidBinding[] }) {
  return (
    <>
      {bindings.map((entry, index) => (
        <Fragment key={`${entry.project}:${entry.binding}`}>
          {index > 0 && ", "}
          binding <RecordName>{entry.binding}</RecordName> in project{" "}
          <RecordName>{entry.project}</RecordName>
        </Fragment>
      ))}
    </>
  );
}

function exampleOf(item: CredentialRefusedItem | RequestRejectedItem): string {
  return item.count > 1 ? ", for example" : "";
}

function AgentInvalidSentence({ item }: { readonly item: AgentInvalidItem }) {
  return (
    <>
      Agent <RecordName>{item.agent}</RecordName> has an invalid configuration
      {item.issues.length === 0 ? "" : ` (${item.issues.join(", ")})`} in{" "}
      <BindingPairs bindings={item.bindings} />. Fix the enablement on the agent page.
    </>
  );
}

export function FixCauseText({ item }: FixCauseTextProps) {
  if (item.kind === "project_paused") {
    return (
      <>
        <RecordName>{item.project.name}</RecordName> is paused. Workers claim none of its nodes.
      </>
    );
  }
  if (item.kind === "no_taker") return <NoTakerSentence item={item} />;
  if (item.kind === "agent_invalid") return <AgentInvalidSentence item={item} />;
  if (item.kind === "credential_refused") {
    return item.credentials.length > 1 ? (
      <>
        The provider refused one credential of the agents{exampleOf(item)} in the execution of{" "}
        <RecordName>{item.nodeName}</RecordName>: <CredentialNames names={item.credentials} />{" "}
        (unauthorized). Rotate the credential that it refused.
      </>
    ) : (
      <>
        The provider refused <RecordName>{item.credential}</RecordName> (unauthorized)
        {exampleOf(item)} in the execution of <RecordName>{item.nodeName}</RecordName>. Rotate the
        credential.
      </>
    );
  }
  return (
    <>
      The provider rejected a request of <RecordName>{item.agent}</RecordName> (bad request)
      {exampleOf(item)} in the execution of <RecordName>{item.nodeName}</RecordName>. Check its
      model and settings.
    </>
  );
}
