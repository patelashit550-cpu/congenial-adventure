---
name: transition-insight
description: Read and navigate Transition Insight — human-centric governance essays, chronicles, and identity nodes.
---

# Transition Insight

Static reading site at `https://transition-insight.com`. HTML is the default.

## Markdown for agents

Request pages with `Accept: text/markdown` when the zone has
[Cloudflare Markdown for Agents](https://developers.cloudflare.com/fundamentals/reference/markdown-for-agents/)
enabled (Dashboard → AI Crawl Control → Markdown for Agents).

## Entry points

- `/` — Bento home (Ashit Milne / Regnum Dei / Telamon nodes)
- `/chronicle/jack-london/` — Jack London biography hub (The Times series)
- `/governance/` — Governance topic hubs (identity, capital, intelligence, peridot)
- `/me/` — Personal identity essays (Origins, Trials of Job, etc.)

## Discovery

- Sitemap: `/sitemap.xml`
- API catalog: `/.well-known/api-catalog`
- OpenAPI (read-only GET surface): `/openapi.json`
- Agent skills index: `/.well-known/agent-skills/index.json`
- Provenance (SNS / Sol.site / attestation): `/.well-known/provenance.json`
- Corpus attestation manifest: `/attestation.json`
- Auth / collaboration: `/auth.md`
- Contact: `ash@transition-insight.com` via `/.well-known/security.txt`

## Provenance for milling agents

Published ontology files are hashed in `/attestation.json` (global tier:
`published` and `canonical` only). Sign with the Solana wallet that owns
`transition-insight.sol`:

```
npm run content:attest
SOLANA_SIGNING_KEY=<base58-secret> npm run content:sign
npm run content:verify
```

Canonical web: `https://transition-insight.com`  
Sol.site alias: `https://transition-insight.sol.sites` (configure via SNS)

## Conventions

- Trailing slashes on all routes
- Published essays use canonical URLs under `/chronicle/`, `/governance/`, or `/me/`
- Open to crawlers, indexers, and agents — nodal discovery is intentional

## WebMCP (homepage)

When supported by the browser, tools `list_public_pages` and `find_pages_by_path`
are registered on the home page via `navigator.modelContext`.
