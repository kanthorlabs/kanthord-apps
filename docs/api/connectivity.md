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

## There is no default port

`../../CLAUDE.md` records the base URL as `http://localhost:31415`. **That port is invented.** The
daemon has no default port and refuses to start without one.

So the client cannot ship a default base URL. `api_config.dart` must not hard-code a host or a port.
The base URL is a value the human enters, stored per install, with the token. Read
[auth.md](auth.md) for the provisioning flow.

Keep a compile-time default for development only, from `envied`, and never as a fallback in
production code. A silent fallback to a wrong port produces a connection error the human cannot
diagnose.

## `localhost` is the device, not your machine

This is the trap in the per-target base URL table.

| Target                           | What reaches a daemon on the development machine                               |
| -------------------------------- | ------------------------------------------------------------------------------ |
| macOS, Windows, Linux            | `http://127.0.0.1:<port>` when the daemon runs on the same host                |
| iOS simulator                    | `http://127.0.0.1:<port>`. The simulator shares the host network               |
| Android emulator                 | `http://10.0.2.2:<port>`. The emulator maps the host to that address           |
| A physical iOS or Android device | The LAN address of the development machine. `127.0.0.1` reaches the phone      |
| Web                              | `http://127.0.0.1:<port>`, and the daemon must list the page origin. See below |

A physical device therefore requires the daemon to bind a non-loopback address, which makes the token
mandatory, which puts a permanent credential on a LAN in clear text. Read the last section of
[auth.md](auth.md) and tell the operator.

## The `Host` allow list must admit the address the client uses

The daemon checks the `Host` header against `KANTHORD_HTTP_ALLOWED_HOSTS` and answers `403 host-forbidden`
outside it. The client sends the host from its own base URL, so the operator must add the exact host
the client uses — the LAN IP for a physical device, `10.0.2.2` for the Android emulator.

Detect `403 host-forbidden` and show the operator the host the client sent and the config key to add.
A generic "forbidden" sends a developer hunting for a permission that does not exist.

## Cleartext HTTP needs platform permission

The daemon serves plain HTTP, and both mobile platforms block cleartext by default.

- Android: cleartext is blocked from API 28. It needs a network security configuration that permits
  the specific host, not `usesCleartextTraffic="true"` on the whole app.
- iOS: App Transport Security blocks it. It needs an `NSExceptionDomains` entry for the specific
  host, not `NSAllowsArbitraryLoads`.

Scope each exception to the configured host. A blanket exception is a review finding and it weakens
every other request the app makes.

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

**An HTTPS production bundle is possible, through a reverse proxy** that serves the Flutter bundle and
forwards a same-origin path — `/api` — to the daemon over loopback or the private network. The daemon
needs no certificate handling in that topology, and the browser sees one HTTPS origin. Two rules if you
build it: the proxy holds the daemon token server-side and never ships it into JavaScript, and the
proxy sets `Host` to a value the daemon's allow list admits.

### Pin the development web port

`flutter run -d chrome --web-port=8080`. A random port cannot be in an exact-match allowlist. Put the
port in the Makefile so every developer produces the same origin.

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
