import { isLoopbackUrl } from "./loopback-url";

export const HOST_KINDS = [
  "Linux (systemd)",
  "macOS (foreground)",
  "Container",
  "Container on this host",
] as const;

export type HostKind = (typeof HOST_KINDS)[number];

export const SAME_HOST_ADDRESS = "http://kanthord:31415";

const INSTANCE_NAME = /^[a-z][a-z0-9-]*$/;
const NAME_MAX_LENGTH = 63;
const RESERVED_NAMES: readonly string[] = ["server", "token", "connect", "heartbeat"];
export const RELEASES = "https://github.com/kanthorlabs/kanthord/releases";

export interface CopyStep {
  readonly text: string;
  readonly command: string | null;
}

export interface AddressDefault {
  readonly address: string;
  readonly hint: string | null;
}

export function hostKindOf(value: string | null): HostKind | null {
  return HOST_KINDS.find((kind) => kind === value) ?? null;
}

export function instanceNameError(name: string): string | null {
  if (name.length === 0) return "Enter a name.";
  if (name.length > NAME_MAX_LENGTH) return `Use at most ${NAME_MAX_LENGTH} characters.`;
  if (!INSTANCE_NAME.test(name)) {
    return "Start with a lowercase letter. Use only lowercase letters, digits and hyphens.";
  }
  if (RESERVED_NAMES.includes(name)) return `The name ${name} is reserved. Choose another name.`;
  return null;
}

export function instanceAddressError(address: string): string | null {
  if (address.trim().length === 0) return "Enter the address of the server.";
  const parsed = URL.parse(address.trim());
  if (parsed === null || (parsed.protocol !== "http:" && parsed.protocol !== "https:")) {
    return "Enter a full http or https URL, for example https://kd.example.com.";
  }
  return null;
}

export function addressDefaultOf(
  kind: HostKind,
  dashboardAddress: string | null,
  serverInContainer: boolean,
): AddressDefault {
  if (kind === "Container on this host" && serverInContainer) {
    return { address: SAME_HOST_ADDRESS, hint: null };
  }
  if (dashboardAddress === null || isLoopbackUrl(dashboardAddress)) {
    return {
      address: "",
      hint: "The dashboard uses a loopback address, which the instance host cannot reach. Enter an address of the server that the instance host reaches, for example http://192.168.1.10:<port>.",
    };
  }
  return { address: dashboardAddress.replace(/\/+$/, ""), hint: null };
}

function linuxSteps(name: string, version: string): readonly CopyStep[] {
  return [
    {
      text: `Download kanthord-linux-<arch> and SHA256SUMS of the release ${version} from ${RELEASES}. <arch> is x64 for an x86_64 host and arm64 for an arm64 host.`,
      command: null,
    },
    {
      text: "Check the download against SHA256SUMS, then install it:",
      command:
        "sha256sum --ignore-missing -c SHA256SUMS\nsudo install -m 755 kanthord-linux-<arch> /usr/local/bin/kanthord",
    },
    {
      text: "Let the user units of the user run without a login session:",
      command: "loginctl enable-linger",
    },
    {
      text: "Write the instance file. kanthord worker join reads the instance configuration from standard input. Paste the value, press Enter, then press Ctrl-D:",
      command: "kanthord worker join",
    },
    {
      text: "Create the directory of the user units, and write the template unit kanthord-worker@.service:",
      command: [
        "mkdir -p ~/.config/systemd/user",
        "cat > ~/.config/systemd/user/kanthord-worker@.service <<'EOF'",
        "[Unit]",
        "Description=KanthorD worker instance %i",
        "",
        "[Service]",
        "ExecStart=/usr/local/bin/kanthord serve worker --instance %i",
        "Restart=on-failure",
        "RestartPreventExitStatus=3",
        "",
        "[Install]",
        "WantedBy=default.target",
        "EOF",
      ].join("\n"),
    },
    {
      text: "Write the settings of this instance. They set the author of the agent commits and turn off core dumps. The memory of the instance holds the plaintext of its LLM credentials.",
      command: [
        `mkdir -p ~/.config/systemd/user/kanthord-worker@${name}.service.d`,
        `cat > ~/.config/systemd/user/kanthord-worker@${name}.service.d/kanthord.conf <<'EOF'`,
        "[Service]",
        'Environment="GIT_AUTHOR_NAME=<git name>" "GIT_AUTHOR_EMAIL=<git email>" "GIT_COMMITTER_NAME=<git name>" "GIT_COMMITTER_EMAIL=<git email>"',
        "LimitCORE=0",
        "EOF",
      ].join("\n"),
    },
    {
      text: "Start the instance, and start it again at each boot:",
      command: `systemctl --user daemon-reload\nsystemctl --user enable --now kanthord-worker@${name}`,
    },
  ];
}

function macSteps(name: string, version: string): readonly CopyStep[] {
  return [
    {
      text: `Download kanthord-darwin-arm64 and SHA256SUMS of the release ${version} from ${RELEASES}.`,
      command: null,
    },
    {
      text: "Check the download against SHA256SUMS, remove the macOS quarantine flag, then install it. Without the xattr command, macOS refuses to start the binary.",
      command:
        "shasum -a 256 --ignore-missing -c SHA256SUMS\nxattr -d com.apple.quarantine kanthord-darwin-arm64\nsudo install -m 755 kanthord-darwin-arm64 /usr/local/bin/kanthord",
    },
    {
      text: "Write the instance file. Paste the value, press Enter, then press Ctrl-D:",
      command: "kanthord worker join",
    },
    {
      text: "Set the author of the agent commits for this terminal. Without the GIT_* variables, a commit has the author kanthord <kanthord@localhost>.",
      command:
        'export GIT_AUTHOR_NAME="<git name>" GIT_AUTHOR_EMAIL="<git email>" GIT_COMMITTER_NAME="<git name>" GIT_COMMITTER_EMAIL="<git email>"',
    },
    {
      text: "Start the instance. Keep the terminal open. After a restart of the Mac, do the last two steps again:",
      command: `kanthord serve worker --instance ${name}`,
    },
  ];
}

function containerSteps(version: string): readonly CopyStep[] {
  return [
    {
      text: "Store the instance configuration as a secret of the platform, and expose it to the container as the env value KANTHORD_WORKER_CONFIG.",
      command: null,
    },
    {
      text: `Use the image docker.io/kanthorlabs/kanthord:${version} with the command serve worker.`,
      command: null,
    },
    {
      text: "Run one replica. A second replica supersedes the first.",
      command: null,
    },
    {
      text: "Publish no port. The instance opens every connection to the server.",
      command: null,
    },
  ];
}

function sameHostSteps(name: string, version: string): readonly CopyStep[] {
  return [
    {
      text: "Put both containers on one network:",
      command: "podman network create kanthord-net\npodman network connect kanthord-net kanthord",
    },
    {
      text: "Store the instance configuration as a Podman secret. podman secret create reads it from standard input. Paste the value, press Enter, then press Ctrl-D:",
      command: `podman secret create kanthord-worker-${name} -`,
    },
    {
      text: "Start the instance. <git name> and <git email> set the identity of the commits that the agents make:",
      command: `podman run -d --name kanthord-worker-${name} --network kanthord-net --cap-drop=ALL --security-opt=no-new-privileges --ulimit core=0 --secret kanthord-worker-${name},type=env,target=KANTHORD_WORKER_CONFIG -e GIT_AUTHOR_NAME="<git name>" -e GIT_AUTHOR_EMAIL="<git email>" -e GIT_COMMITTER_NAME="<git name>" -e GIT_COMMITTER_EMAIL="<git email>" docker.io/kanthorlabs/kanthord:${version} serve worker`,
    },
  ];
}

export function copyStepsOf(kind: HostKind, name: string, version: string): readonly CopyStep[] {
  if (kind === "Linux (systemd)") return linuxSteps(name, version);
  if (kind === "macOS (foreground)") return macSteps(name, version);
  if (kind === "Container") return containerSteps(version);
  return sameHostSteps(name, version);
}

export function shortFingerprint(fingerprint: string): string {
  const [prefix, digest = ""] = fingerprint.split(":");
  return digest.length <= 12 ? fingerprint : `${prefix}:${digest.slice(0, 12)}…`;
}
