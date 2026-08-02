# AGENTS.md

## Cursor Cloud specific instructions

### What this repo is

`planet-iii-next` ("Transition Insight") is a single **Next.js 16 / React 19** app that
statically exports a content-driven publication. Essays live as Markdown/MDX under
`ontology/` and render through the App Router (`src/app/(reading)/[...slug]/page.tsx`).
There is **no backend, database, or runtime service** — it is a pure static site.
Package manager is **npm** (Node 22). Standard commands live in `package.json` `scripts`;
CI is `.github/workflows/deploy-pages.yml` (runs `npm ci` then `npm run build:global`).

### Running / building / linting (see `package.json` for the full list)

- Dev server: `npm run dev` → http://localhost:3000. Defaults to the `local` content
  tier, which shows **all** stages including `draft`. Tier variants: `dev:local`,
  `dev:preprod`, `dev:global`.
- Production build (static export to `out/`): `npm run build:global` (this is what CI
  runs). Plain `npm run build` also works. The build chains several `scripts/*.mjs`
  generators before/after `next build`, ending with `stress-recon-defense.mjs` (bot/agent
  recon stress test + learning memory in `scripts/data/recon-memory.json`).
- Lint: `npm run lint` (`eslint .`). There is **no test suite** and no type-check script
  (types are checked as part of `next build`; run `npx tsc --noEmit` for a standalone check).
  Standalone recon stress: `npm run stress:recon` (requires a fresh `out/`).

### Non-obvious gotchas

- **New/renamed ontology content 404s until the dev server restarts.** The `[...slug]`
  route sets `dynamicParams = false` and enumerates pages via `generateStaticParams`,
  which `next dev` evaluates once at startup. Adding a Markdown file under `ontology/`
  while `npm run dev` is running returns HTTP 404 for its URL (the body may still render)
  — restart the dev server to pick up new slugs.
- **Content visibility is tier-gated by frontmatter `stage`** (`draft` → `review` →
  `published`/`canonical`), controlled by `NEXT_PUBLIC_CONTENT_TIER`
  (`local`/`preprod`/`global`). `local`/dev shows drafts; `global` (production build) shows
  only `published`/`canonical`. See `src/lib/content-tier.ts`.
- **The build writes generated files into the working tree** — `next-env.d.ts`,
  `public/attestation.json`, `public/.well-known/*` (corpus-graph, provenance,
  agent-skills), plus an untracked `semantic-graph/` dir. Do **not** commit those build
  outputs; revert them (`git checkout -- <file>`) / delete `semantic-graph/` before committing.
  Exception: `scripts/data/recon-memory.json` is the recon-defense learning store — **do**
  commit updates when the stress test records new lessons or surface deltas.
- **Pre-existing lint errors** exist in `src/components/bento/BentoHomeEqualRows.tsx`
  (`react-hooks/set-state-in-effect`). They do not block deploy because CI runs only
  `build:global`, not `npm run lint`.
- Optional integrations are **not needed** for local dev/build: Pinata/IPFS
  (`.env.sovereign.example`), Ollama (`canon:generate:ollama`), and Python + Pillow
  (`process:bento-emblems`).
