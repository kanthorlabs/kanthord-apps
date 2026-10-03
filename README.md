# KanthorD

A React control surface for the kanthord daemon, a plan-and-DAG execution engine.

## Layout

```
.
├── src/        # the application
├── mock/       # a development stand-in for the daemon
└── test/       # the vitest bootstrap and its helpers
```

## Commands

Run every command from this directory.

| Command          | Effect                                  |
| ---------------- | --------------------------------------- |
| `pnpm install`   | Install every dependency                |
| `pnpm dev`       | Start the app on http://localhost:27182 |
| `pnpm dev:all`   | Start the mock daemon and the app       |
| `pnpm build`     | Build the app                           |
| `pnpm test`      | Run the test suite                      |
| `pnpm typecheck` | Typecheck the repository                |
| `pnpm verify`    | Run the whole gate                      |

## The daemon

The app expects the daemon at `http://localhost:31415` and signs in with a username and a password.
The daemon returns a token, and every later request carries it.

The daemon does not exist yet, so `mock/` serves the API contract defined in `src/api`.
It is a development stand-in, it is not part of the application, and no module under `src/` reaches it.

```bash
pnpm dev:all     # the mock daemon and the app together
pnpm mock        # the mock daemon alone
```

The login page manages the instances: add the base URL of a daemon, then paste a human JWT. The mock
daemon accepts the dev token `dev-human-token`. Override the token, the port and the allowed origin
with `KANTHORD_DEV_TOKEN`, `KANTHORD_HTTP_PORT` and `KANTHORD_HTTP_ALLOWED_ORIGINS`. Set
`KANTHORD_MOCK_UNHEALTHY=1` to make `/api/liveness` answer 503.

When the real daemon arrives it must serve the same contract. `src/api/types.ts` is the whole of it.
