import type { ConversationBindingConfig } from "@/api/types";
import { Badge } from "@/components/ui/badge";
import { conversationFactsOf } from "@/lib/conversation-facts";
import { type Fact, FactList } from "./fact-list";

interface ConversationFormProps {
  readonly config: ConversationBindingConfig;
}

export function ConversationForm({ config }: ConversationFormProps) {
  const facts: Fact[] = conversationFactsOf(config).map((fact) =>
    fact.label === "State"
      ? {
          label: fact.label,
          value: (
            <Badge variant={config.available ? "secondary" : "destructive"}>{fact.value}</Badge>
          ),
        }
      : fact,
  );
  return <FactList facts={facts} />;
}
