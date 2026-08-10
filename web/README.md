# m-proper web

TanStack Start UI for m-proper. Talks to the Rust API at `VITE_API_BASE_URL` (default `http://localhost:3000`).

## Develop

```bash
# from repo root
pnpm install
pnpm run dev:web
# http://localhost:3001
```

## Build

```bash
pnpm run build:web
```

## Lint / format

```bash
pnpm --filter web lint
pnpm --filter web format
pnpm --filter web check
```
