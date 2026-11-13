import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { avatarToken } from "@/lib/agent-avatar";

interface AgentAvatarProps {
  readonly agentName: string;
  readonly displayName: string;
}

export function AgentAvatar({ agentName, displayName }: AgentAvatarProps) {
  const token = avatarToken(agentName);
  return (
    <Avatar role="img" aria-label={`${displayName} avatar`}>
      <AvatarFallback
        aria-hidden="true"
        style={{ backgroundColor: `var(--${token})`, color: "var(--avatar-foreground)" }}
      >
        {displayName.slice(0, 1).toUpperCase()}
      </AvatarFallback>
    </Avatar>
  );
}
