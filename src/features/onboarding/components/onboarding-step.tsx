import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from "@/components/ui/item";
import { stepStateLabel, stepStateVariant, type OnboardingStep as Step } from "@/lib/onboarding";
import { returnToState } from "@/lib/return-to";

interface OnboardingStepProps {
  readonly step: Step;
  readonly position: number;
}

export function OnboardingStep({ step, position }: OnboardingStepProps) {
  const { action } = step;
  return (
    <Item variant="outline" role="listitem" aria-label={step.title}>
      <ItemContent className="min-w-0">
        <ItemTitle className="w-full flex-wrap">
          <span className="text-muted-foreground tabular-nums">{position}.</span>
          <span>{step.title}</span>
          <Badge variant={stepStateVariant(step.state)}>{stepStateLabel(step.state)}</Badge>
        </ItemTitle>
        <ItemDescription className="line-clamp-none break-words">
          {step.description}
        </ItemDescription>
      </ItemContent>
      <ItemActions className="w-full md:w-auto md:justify-end">
        <Button
          nativeButton={false}
          render={<Link to={action.path} state={returnToState("/")} />}
          variant={step.state === "next" ? "default" : "outline"}
          size="sm"
        >
          {action.label}
        </Button>
      </ItemActions>
    </Item>
  );
}
