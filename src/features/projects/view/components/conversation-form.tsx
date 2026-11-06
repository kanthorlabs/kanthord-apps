import type { ConversationBindingConfig } from "@/api/types";
import { conversationFactsOf } from "@/lib/conversation-facts";
import { FactList } from "./fact-list";

interface ConversationFormProps {
  readonly config: ConversationBindingConfig;
}

export function ConversationForm({ config }: ConversationFormProps) {
  return <FactList facts={conversationFactsOf(config)} />;
}
