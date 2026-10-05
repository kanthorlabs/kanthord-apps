const SSH_NAME_MAX = 63;

export function sshAliasToName(alias: string): string {
  let name = alias.toLowerCase().replace(/[^a-z0-9-]/g, "-");
  if (!/^[a-z]/.test(name)) {
    name = `ssh-${name}`;
  }
  return name.slice(0, SSH_NAME_MAX);
}
