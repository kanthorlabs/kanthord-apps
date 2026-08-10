# Connectivity

How the client reaches the daemon, per platform. This closes the "LAN IP" and "HTTPS base URL"
blockers in `../../HANDOFF.md`, and it opens a larger one about the web target.

## The daemon side

| Setting           | Env var                       | Default                  |
| ----------------- | ----------------------------- | ------------------------ |
| Bind address      | `KANTHORD_HTTP_BIND`          | `127.0.0.1`              |
| Port              | `KANTHORD_HTTP_PORT`          | **none. It is required** |
| Bearer token      | `KANTHORD_HTTP_TOKEN`         | empty                    |
| `Host` allow list | `KANTHORD_HTTP_ALLOWED_HOSTS` | none                     |

The daemon serves **plain HTTP** and ships no certificate handling. It refuses to start on a
non-loopback bind address with no token.

## The port is a convention: 31415. DECIDED

**Both repositories assume the daemon serves `http://127.0.0.1:31415` and `http://localhost:31415`.**
An earlier draft called that port invented. It is now the agreed convention, and every document, every
example and every development script uses it.

A convention is not a daemon default. `KANTHORD_HTTP_PORT` still has no default and the daemon still
refuses to start without one, so an operator always sets it — and sets it to `31415` unless something
on the host already holds that port.

What follows for the client:

- `api_config.dart` hard-codes no host and no port. The base URL stays a stored value read through
  `BaseUrlProviderType`.
- The convention is a **prefill**, never a fallback. The connect field opens with
  `http://localhost:31415` visible and editable, and a stored value always wins. The client sends no
  request to an address the human has not confirmed, so a wrong port is still a visible value rather
  than a connection error nobody can diagnose.
- `envied` carries the same value as the development default. It stays a prefill there too.

Both spellings matter, because they are different origins and different `Host` headers. `127.0.0.1`
and `localhost` are not interchangeable to the daemon's allow lists, so configure both.

## `localhost` is the device, not your machine

This is the trap in the per-target base URL table.

| Target                           | What reaches a daemon on the development machine                              |
| -------------------------------- | ----------------------------------------------------------------------------- |
| **Web. The development host**    | `http://localhost:31415`, and the daemon must list the page origin. See below |
| macOS, Windows, Linux            | `http://127.0.0.1:31415` when the daemon runs on the same host                |
| iOS simulator                    | `http://127.0.0.1:31415`. The simulator shares the host network               |
| Android emulator                 | `http://10.0.2.2:31415`. The emulator maps the host to that address           |
| A physical iOS or Android device | `http://<lan-ip>:31415`. `127.0.0.1` reaches the phone, never your machine    |

A physical device therefore requires the daemon to bind a non-loopback address, which makes the token
mandatory, which puts a permanent credential on a LAN in clear text. Read the last section of
[auth.md](auth.md) and tell the operator.

## The `Host` allow list must admit the address the client uses

The daemon checks the `Host` header against `KANTHORD_HTTP_ALLOWED_HOSTS` and answers
`403 host-forbidden` outside it. The match is **exact and case-insensitive on the whole header
value**, and a non-default port is part of that value — `src/http/server/host.ts` compares
`host.toLowerCase()` against the set. So `localhost:31415` and `127.0.0.1:31415` are two entries, not
one, and neither covers the other.

The client sends the host from its own base URL, so the operator lists every spelling a client uses:
both loopback forms for local work, `10.0.2.2:31415` for the Android emulator, and the LAN address
for a physical device.

Detect `403 host-forbidden` and show the operator the host the client sent and the config key to add.
A generic "forbidden" sends a developer hunting for a permission that does not exist.

## Cleartext HTTP is permitted in every build. DECIDED

The daemon serves plain HTTP, and both mobile platforms restrict cleartext by default.

- Android: cleartext is blocked from API 28, by a network security configuration.
- iOS: App Transport Security restricts it, by `NSExceptionDomains` or `NSAllowsArbitraryLoads`.

Two earlier drafts of this section were wrong, and both are withdrawn.

**"Scope the exception to the configured host" is impossible.** A network security XML and an
`Info.plist` compile into the bundle. The daemon host is typed by the human at runtime and may be any
LAN address, so no build-time file can name it. Scoping and arbitrary-host support are mutually
exclusive.

**"A release build permits no cleartext" is wrong about the product.** The client connects to a
daemon at an address and port the operator gives it. That is the whole design. A release build with
no cleartext permission cannot do the one thing the app is for, and pushing every shipped install
behind a reverse proxy solves a problem this product does not have.

**The decision: permit cleartext to any host, in every build variant, on Android and on iOS.**

So the exception is broad, in every variant, and it is not a review finding. The app talks to one
plain-HTTP service on an operator-chosen host, and the permission is exactly as wide as that
requirement. Narrowing it would be a claim the client cannot keep.

The cost is real and it belongs to the operator, not to the manifest: a permanent bearer token
crosses the network in clear text. Read the last section of [auth.md](auth.md), and warn the human
when the base URL is not loopback. **The mitigation is the warning and the network boundary, never a
platform flag.**

`scripts/platform-config-check.sh` asserts the permission is present on both mobile targets. It
cannot assert that a static file admits a runtime host, and it claims no such thing.

Desktop is unaffected: no desktop target has a cleartext policy. Web is unaffected by these files and
constrained by its own rule instead — the page scheme must match the daemon scheme.

**Measure the enforcement, do not assume it.** Dart sockets do not always go through the platform
HTTP stack, so whether each platform actually blocks a Flutter cleartext request is a device
question. Configure the permission either way, and measure on a device.

## The web target is supported, under named conditions

The owner has decided that web is supported. The engine gains a **browser-access mode**: an
allowed-origin list that is empty by default, so an unconfigured daemon behaves exactly as it does
today and rejects any `Origin` header with `403 origin-forbidden`. A human who wants a browser client
names the exact origin.

Engine side, from `kanthord-engine/.agent/plan/epics/010.5-browser-access.md`:

| Setting         | Env var                         | Default                   |
| --------------- | ------------------------------- | ------------------------- |
| Allowed origins | `KANTHORD_HTTP_ALLOWED_ORIGINS` | empty. Browser access off |

An entry is one exact origin — `scheme://host[:port]` — canonicalized by the daemon through the URL
parser. A wildcard, a suffix pattern, a path, a trailing slash, embedded credentials and the literal
`null` are each refused at load. The daemon refuses to start with a non-empty origin list and no
token.

What the daemon sends to an allowed origin: `Access-Control-Allow-Origin` set to the exact origin,
`Origin` appended to `Vary`, and `Access-Control-Expose-Headers` naming `etag`, `accept-ranges` and
`content-range` so a script can read what `blob.show` returns. A preflight answers `204` and allows
`DELETE, GET, POST, PUT` with the headers `authorization`, `content-type`, `idempotency-key`,
`if-none-match` and `x-kanthord-client`. `Access-Control-Allow-Credentials` is never set, because the
client authenticates with a header and not a cookie.

**The `Host` allow list still applies to every request.** It is the DNS rebind defence, not the origin
list. Configure it alongside the origin.

### Supported topologies

| Page origin              | Daemon                          | Verdict                                                                |
| ------------------------ | ------------------------------- | ---------------------------------------------------------------------- |
| `http://localhost:8080`  | `http://127.0.0.1:<port>`       | Supported. Local to local                                              |
| `http://<lan-host>:8080` | `http://<lan-ip>:<port>`        | Supported. Private to private                                          |
| `https://<public>`       | `http://<private>` **directly** | Refused. Mixed content blocks it, and Private Network Access blocks it |
| `https://<public>`       | via a reverse proxy             | Supported. See below                                                   |

The page scheme must match the daemon scheme for a direct call, and the daemon serves plain HTTP only.

**This is the only topology that needs a proxy.** Every native target calls the daemon directly at the
address and port the operator gives it. A proxy is a browser workaround for mixed content, never a
requirement of the product.

**An HTTPS production bundle is possible, through a reverse proxy** that serves the Flutter bundle and
forwards a same-origin path — `/api` — to the daemon over loopback or the private network. The daemon
needs no certificate handling in that topology, and the browser sees one HTTPS origin. Two rules if you
build it: the proxy holds the daemon token server-side and never ships it into JavaScript, and the
proxy sets `Host` to a value the daemon's allow list admits.

### Web is the development host, and the port is pinned

**`make dev` is the development loop.** It runs Chrome at `http://localhost:8080`, and it needs no
simulator and no emulator. A browser window also resolves the desktop layout family, which is the
family this product targets first.

The port is pinned in the `Makefile` — `--web-port=8080 --web-hostname=localhost` — because a random
port cannot be in an exact-match allowlist. Every developer therefore produces the same origin.

The daemon side is three variables, and this is the whole local setup:

```bash
KANTHORD_HTTP_PORT=31415
KANTHORD_HTTP_ALLOWED_HOSTS=127.0.0.1:31415,localhost:31415
KANTHORD_HTTP_ALLOWED_ORIGINS=http://localhost:8080
KANTHORD_HTTP_TOKEN=<the value you type into the client>
```

The client then connects to `http://localhost:31415`, which is what the connect field already shows.

**The engine already implements it.** `kanthord-engine` EPIC 010.5 is merged and human-reviewed, so
`originMiddleware` answers `403 origin-forbidden` outside the list and sets the allow-origin,
`Vary` and expose-headers responses inside it. No client work waits on the engine here.

Set the `Host` allow list too. It is a separate check and it applies to every request.

**A configured origin is an authority, not an app identity.** Every script at that origin reaches the
daemon: an injected script, a compromised dev server, and any other process that takes port 8080.
Pinning the port makes the configuration work and makes a local origin takeover predictable. This is
the accepted cost of web support.

### Two web facts that change how the client reports failure

**A browser failure is opaque.** In a browser, an origin rejection, a host rejection, a daemon that is
down, and a DNS failure all reach Dio as the same generic network error with no status and no body. A
web build therefore cannot distinguish them, and the error message must say so: name all four causes
and name the two config keys. Do not claim a precise cause on web. On native the same failures are
distinguishable, so keep the precise messages there.

**Browser support is a decision, not a given.** "Flutter web" is not a compatibility statement. Name
the browsers and versions the product supports and test them, and re-check Private Network Access
behaviour on each: the policy is still evolving and may add a permission prompt or a further header for
a topology that works today.

Also test `blob.show` in a real browser before relying on it. `Range` is CORS-safelisted only under a
restricted syntax, and a browser revalidating with `If-None-Match` needs that header in the allow list,
which is why it is there.

### Token storage on web

Memory only, and the session ends when the tab closes. The daemon token never expires, cannot be
rotated by an API call and cannot be revoked from the client, so any same-origin script that reads it
holds a permanent credential. There is no refresh rotation to limit the window. Read
[auth.md](auth.md).

## Timeouts

`api_config.dart` holds the connect, receive and send timeouts, unchanged from `../../HANDOFF.md`.

Set the receive timeout per operation, not once. `repository.inspect` reaches a git forge over the
network and `repository.register` runs a host key scan, so both take seconds. A timeout tuned for
`GET /v1/health` fails them. `plan.import` validates a whole document set in one transaction.
