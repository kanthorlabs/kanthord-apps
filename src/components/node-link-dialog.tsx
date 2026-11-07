import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { NodeLinkState } from "@/hooks/use-node-link";

export function NodeLinkDialog({
  subject,
  link,
}: {
  readonly subject: string;
  readonly link: NodeLinkState;
}) {
  return (
    <Dialog open onOpenChange={(open) => !open && link.cancel()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Link {subject} to a node</DialogTitle>
          <DialogDescription>
            The node gets the address of the thread and the conversation binding. Its other fields
            stay as they are.
          </DialogDescription>
        </DialogHeader>
        {link.candidates.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            The project holds no node that is open and not retired.
          </p>
        ) : (
          <RadioGroup
            aria-label="Node to link"
            value={link.picked ?? ""}
            onValueChange={(value) => link.pick(String(value))}
          >
            {link.candidates.map((node) => (
              <Field key={node.id} orientation="horizontal">
                <RadioGroupItem id={`node-link-${node.id}`} value={node.id} />
                <FieldLabel htmlFor={`node-link-${node.id}`}>
                  <span className="break-words">{node.content.name}</span>
                  <Badge variant="outline">{node.state}</Badge>
                </FieldLabel>
              </Field>
            ))}
          </RadioGroup>
        )}
        {link.missing !== null && <p className="text-sm text-muted-foreground">{link.missing}</p>}
        {link.error !== null && (
          <p role="alert" className="text-sm text-destructive">
            {link.error}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" disabled={link.linking} onClick={link.cancel}>
            Cancel
          </Button>
          <Button
            disabled={link.linking || link.picked === null || link.missing !== null}
            onClick={link.submit}
          >
            Link to node
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
