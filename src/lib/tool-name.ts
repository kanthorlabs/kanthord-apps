export function toolNameOf(operationId: string): string {
  return operationId.replaceAll(".", "--");
}
