const GITHUB =
  "https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/githubs-ssh-key-fingerprints";
const GITLAB = "https://docs.gitlab.com/user/gitlab_com/#ssh-host-keys-fingerprints";
const BITBUCKET =
  "https://support.atlassian.com/bitbucket-cloud/docs/configure-ssh-and-two-step-verification/";

const PUBLISHED: Readonly<Record<string, string>> = {
  "github.com": GITHUB,
  "ssh.github.com": GITHUB,
  "gitlab.com": GITLAB,
  "altssh.gitlab.com": GITLAB,
  "bitbucket.org": BITBUCKET,
  "altssh.bitbucket.org": BITBUCKET,
};

export function publishedFingerprintsUrl(host: string): string | null {
  return PUBLISHED[host] ?? null;
}
