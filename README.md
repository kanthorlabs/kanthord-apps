# KanthorD

A React control surface for the kanthord daemon, a plan-and-DAG execution engine.

## Layout

```
.
├── src/        # the application
└── test/       # the vitest bootstrap and its helpers
```

## Commands

Run every command from this directory.

| Command          | Effect                                  |
| ---------------- | --------------------------------------- |
| `pnpm install`   | Install every dependency                |
| `pnpm dev`       | Start the app on http://localhost:27182 |
| `pnpm build`     | Build the app                           |
| `pnpm test`      | Run the test suite                      |
| `pnpm typecheck` | Typecheck the repository                |
| `pnpm verify`    | Run the whole gate                      |

## The daemon

The app expects the daemon at `http://localhost:31415`. Start it with these
variables, because the daemon matches an allowed origin exactly.

```bash
KANTHORD_HTTP_PORT=31415
KANTHORD_HTTP_ALLOWED_HOSTS=127.0.0.1:31415,localhost:31415
KANTHORD_HTTP_ALLOWED_ORIGINS=http://localhost:27182
KANTHORD_HTTP_TOKEN=<the value you type into the client>
```
