import type { LinkTrust } from "@/api/types";
import { trustedActorsText } from "@/lib/conversation-facts";
import { FactList } from "./fact-list";

interface LinkTrustFactsProps {
  readonly linkTrust: LinkTrust;
}

export function LinkTrustFacts({ linkTrust }: LinkTrustFactsProps) {
  return <FactList facts={[{ label: "Trusted actors", value: trustedActorsText(linkTrust) }]} />;
}
