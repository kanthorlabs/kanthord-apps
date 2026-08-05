# Authentication

This document closes the second blocker in `../../HANDOFF.md`: "the auth flow: how a user signs in,
the refresh endpoint path and payload, the token lifetime".

**There is no sign-in. There is no refresh endpoint. There is no token lifetime.**

## The model

One static bearer token, read from daemon configuration, compared in constant time. The daemon
refuses to start on a non-loopback bind address with no token configured.

There is no user model. One token serves one human. Every route needs the token, `system.health`
included. The daemon has no anonymous surface: an unauthenticated request answers `401` whatever it
asks for, so a registered path and an unregistered path answer identically and the route table is
not readable without the token.

The token never expires, is never issued by the daemon, and is never rotated by an API call. A human
sets `KANTHORD_HTTP_TOKEN` on the daemon and types the same value into the client.

## What this deletes from step 4c

Every item below was specified in `../../HANDOFF.md` step 4c. Delete each one. Do not defer it,
because there is nothing to come back for.

| Deleted                                                        | Why                           |
| -------------------------------------------------------------- | ----------------------------- |
| Refresh once per token                                         | No refresh endpoint exists    |
| The shared single-flight refresh `Future`                      | Nothing to de-duplicate       |
| A second `Dio` without the auth interceptor                    | No refresh request to isolate |
| Clear the tokens on a failed refresh                           | No refresh can fail           |
| `refreshToken()` on `TokenProviderType`                        | There is one token            |
| The test "fire three concurrent 401s, assert one refresh call" | No refresh call to count      |

## The interceptor, in full

```dart
abstract class TokenProviderType {
  Future<String?> token();
  Future<void> save(String token);
  Future<void> clear();
}
```

`auth_interceptor.dart`:

- Read the token through `TokenProviderType`. Attach it as `Authorization: Bearer <token>`.
- A null or empty token is a configuration state, not a request. Throw
  `ApiUnauthorizedException` before the request leaves, so the app shows the token form rather than
  waiting on a round trip that must fail.
- On a `401`, throw `ApiUnauthorizedException`. **Never retry and never refresh.**
- **Do not clear the stored token on a 401.** The token is the only configuration the human typed,
  and a `401` may mean the operator rotated the daemon token or typed a wrong character. Clearing it
  destroys the value the human needs to see to fix it. Surface an unauthorized state and let the app
  layer decide. Only an explicit user action clears the token.

## The provisioning flow the app must build

No sign-in does not mean no work. The app owns the whole token lifecycle, and nothing in the API
helps it.

1. A first-run screen that takes the base URL and the token. Read
   [connectivity.md](connectivity.md) for the base URL.
2. A validation call. `GET /v1/health` is the right probe: it is live today, it needs the token, and
   its body reports which subsystem is down. A `200` proves the URL, the `Host` allow list and the
   token together. A `401` names the token. A `403` names the configuration. A connection failure
   names the URL.
3. A settings screen to replace both values, because the operator will rotate the daemon token.
4. An unauthorized state that shows the current base URL and offers to re-enter the token. Never a
   silent sign-out.

This is a design-system and product surface that `../../HANDOFF.md` never scoped. It belongs in the
first feature, before any read screen, because no read screen works without it.

## Storage

Unchanged from `../../HANDOFF.md` step 4a, and the reason is stronger now.

- Native: `flutter_secure_storage`, which uses the keychain and the keystore.
- Web: memory only. A web session ends when the tab closes.

Never write the token to `shared_preferences` and never to `localStorage`.

The token is now a **long-lived credential with no expiry**, which raises the cost of leaking it: a
stolen token does not age out and cannot be revoked from the client. On web it is also exposed to any
same-origin script, and there is no refresh rotation to limit the window. This is one more reason the
web target needs an owner decision. See [connectivity.md](connectivity.md).

## The token crosses the network in clear text

The daemon serves plain HTTP and ships no certificate handling. Transport encryption is expected to
come from the private network.

On loopback this is fine. **On a LAN it is not**: anyone who can observe the traffic reads the bearer
token, and the token never expires. A private network is a network boundary, not an authorization
boundary, and the engine says so explicitly — which is exactly why it requires a token at all.

State this in the app to the operator when the base URL is not loopback. Do not silently send a
permanent credential in clear text across a LAN without telling the human.
