/**
 * Reflexive recon-defense stress test for the static export.
 *
 * Runs against `out/` after sitemap generation. Simulates how bots and agents
 * recon a site (RFC discovery, CMS probes, secret path guesses, stage leaks),
 * compares the live surface to prior builds, and persists lessons in
 * `scripts/data/recon-memory.json` so each build teaches the next.
 *
 * Critical/high findings fail the build. Memory always updates (learning
 * continues on failure). Pass `--dry-run` to skip writing memory.
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  getContentBuildTier,
  isStageIncludedInBuild,
  normalizeStage,
} from "./lib/content-provenance.mjs";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "out");
const MEMORY_PATH = path.join(ROOT, "scripts", "data", "recon-memory.json");
const DRY_RUN = process.argv.includes("--dry-run");
const TIER = getContentBuildTier();
const NOW = new Date().toISOString();
const HISTORY_LIMIT = 40;
const LESSON_LIMIT = 80;

/** Surfaces agents are meant to find — defense by clear doors, not obscurity. */
const INTENTIONAL_SURFACES = [
  "/sitemap.xml",
  "/robots.txt",
  "/openapi.json",
  "/auth.md",
  "/attestation.json",
  "/ontology-manifest.json",
  "/.well-known/security.txt",
  "/.well-known/api-catalog",
  "/.well-known/provenance.json",
  "/.well-known/corpus-graph.json",
  "/.well-known/agent-skills/index.json",
  "/.well-known/agent-skills/transition-insight/SKILL.md",
];

/**
 * Recon playbook: families mirror how crawlers and milling agents typically probe.
 * - expectPresence: file must exist in out/
 * - mustNotAdvertise: path/token must not appear in sitemap/openapi/robots
 */
const RECON_PLAYBOOK = [
  {
    id: "rfc-discovery",
    agentBias: "RFC-aware agents hit security.txt / robots / sitemap first",
    probes: [
      { path: "/.well-known/security.txt", expectPresence: true },
      { path: "/robots.txt", expectPresence: true },
      { path: "/sitemap.xml", expectPresence: true },
    ],
  },
  {
    id: "agent-catalog",
    agentBias: "Tool-using agents prefer machine catalogs over HTML scraping",
    probes: [
      { path: "/openapi.json", expectPresence: true },
      { path: "/.well-known/api-catalog", expectPresence: true },
      { path: "/.well-known/agent-skills/index.json", expectPresence: true },
      { path: "/auth.md", expectPresence: true },
      { path: "/llms.txt", expectPresence: false },
      { path: "/ai.txt", expectPresence: false },
      { path: "/.well-known/llms.txt", expectPresence: false },
    ],
  },
  {
    id: "provenance-attestation",
    agentBias: "Milling agents chase provenance + attestation digests",
    probes: [
      { path: "/.well-known/provenance.json", expectPresence: true },
      { path: "/attestation.json", expectPresence: true },
      { path: "/.well-known/corpus-graph.json", expectPresence: true },
    ],
  },
  {
    id: "cms-admin",
    agentBias: "Dumb bots spray CMS/admin path dictionaries",
    probes: [
      { path: "/wp-admin/index.html", expectPresence: false },
      { path: "/wp-login.php", expectPresence: false },
      { path: "/admin/index.html", expectPresence: false },
      { path: "/administrator/index.html", expectPresence: false },
      { path: "/phpmyadmin/index.html", expectPresence: false },
      { path: "/graphql/index.html", expectPresence: false },
      { path: "/api/index.html", expectPresence: false },
      { path: "/swagger.json", expectPresence: false },
      { path: "/swagger-ui/index.html", expectPresence: false },
    ],
  },
  {
    id: "secret-paths",
    agentBias: "Credential hunters probe env, keys, and VCS metadata",
    probes: [
      { path: "/.env", expectPresence: false },
      { path: "/.env.local", expectPresence: false },
      { path: "/.env.production", expectPresence: false },
      { path: "/.git/HEAD", expectPresence: false },
      { path: "/.git/config", expectPresence: false },
      { path: "/.svn/entries", expectPresence: false },
      { path: "/id_rsa", expectPresence: false },
      { path: "/credentials.json", expectPresence: false },
      { path: "/secrets.json", expectPresence: false },
      { path: "/config.json", expectPresence: false },
      { path: "/package.json", expectPresence: false },
      { path: "/package-lock.json", expectPresence: false },
    ],
  },
  {
    id: "internal-scaffolding",
    agentBias:
      "Curious agents follow odd prefixes; Next may emit __p3 shells — never advertise them",
    probes: [
      { path: "/__p3/", mustNotAdvertise: true },
      { path: "/_not-found", mustNotAdvertise: true },
      { path: "/semantic-graph/index.html", expectPresence: false },
      { path: "/.next/BUILD_ID", expectPresence: false },
      { path: "/node_modules/next/package.json", expectPresence: false },
    ],
  },
];

const SECRET_PATTERNS = [
  { id: "pem-private-key", re: /BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY/ },
  { id: "aws-access-key", re: /AKIA[0-9A-Z]{16}/ },
  { id: "openai-ish-key", re: /\bsk-[A-Za-z0-9]{32,}\b/ },
  // Ignore docs placeholders like SOLANA_SIGNING_KEY=<base58-secret>
  {
    id: "env-secret-assignment",
    re: /\b(PINATA_JWT|SOLANA_SIGNING_KEY|AWS_SECRET_ACCESS_KEY)\s*=\s*["']?(?!<)[A-Za-z0-9_./+-]{20,}/,
  },
];

const PUBLIC_TEXT_EXTS = new Set([
  ".html",
  ".txt",
  ".json",
  ".xml",
  ".md",
  ".webmanifest",
]);

function failHard(message) {
  console.error(`recon-defense: ${message}`);
  process.exit(1);
}

function outExists(urlPath) {
  const rel = urlPath.replace(/^\//, "").replace(/\/$/, "");
  const direct = path.join(OUT, rel);
  if (fs.existsSync(direct)) return true;
  // Directory probes like /__p3/
  if (urlPath.endsWith("/")) return fs.existsSync(path.join(OUT, rel));
  return false;
}

function walkFiles(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === "_next" || ent.name === "node_modules") continue;
      walkFiles(full, acc);
    } else {
      acc.push(full);
    }
  }
  return acc;
}

function publicUrlFromOutFile(filePath) {
  const rel = path.relative(OUT, filePath).split(path.sep).join("/");
  if (rel.endsWith("/index.html")) {
    const base = rel.slice(0, -"/index.html".length);
    return base ? `/${base}/` : "/";
  }
  if (rel === "index.html") return "/";
  return `/${rel}`;
}

function loadMemory() {
  if (!fs.existsSync(MEMORY_PATH)) {
    return {
      version: 1,
      createdAt: NOW,
      updatedAt: null,
      builds: 0,
      probeStats: {},
      knownPublicPaths: [],
      intentionalSurfaces: INTENTIONAL_SURFACES,
      lessons: [],
      history: [],
    };
  }
  return JSON.parse(fs.readFileSync(MEMORY_PATH, "utf8"));
}

function rememberLesson(memory, lesson) {
  const key = `${lesson.kind}:${lesson.summary}`;
  const existing = memory.lessons.find((l) => `${l.kind}:${l.summary}` === key);
  if (existing) {
    existing.lastSeenAt = NOW;
    existing.timesSeen = (existing.timesSeen ?? 1) + 1;
    existing.builds = (existing.builds ?? 0) + 1;
    return;
  }
  memory.lessons.unshift({
    ...lesson,
    firstSeenAt: NOW,
    lastSeenAt: NOW,
    timesSeen: 1,
    builds: 1,
  });
  memory.lessons = memory.lessons.slice(0, LESSON_LIMIT);
}

function discoverPublicPaths() {
  const paths = [];
  function walk(dir, segments = []) {
    const indexHtml = path.join(dir, "index.html");
    if (fs.existsSync(indexHtml)) {
      if (segments.length === 0) paths.push("/");
      else if (segments[0] !== "__p3" && segments[0] !== "404" && segments[0] !== "_not-found") {
        paths.push(`/${segments.join("/")}/`);
      }
    }
    if (!fs.existsSync(dir)) return;
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!ent.isDirectory()) continue;
      if (
        ent.name.startsWith(".") ||
        ent.name === "_next" ||
        ent.name === "assets" ||
        ent.name === "fonts" ||
        ent.name === "visuals"
      ) {
        continue;
      }
      walk(path.join(dir, ent.name), [...segments, ent.name]);
    }
  }
  walk(OUT);
  return [...new Set(paths)].sort();
}

function readDiscoveryDocs() {
  const read = (rel) => {
    const fp = path.join(OUT, rel);
    return fs.existsSync(fp) ? fs.readFileSync(fp, "utf8") : "";
  };
  return {
    sitemap: read("sitemap.xml"),
    openapi: read("openapi.json"),
    robots: read("robots.txt"),
  };
}

function checkStageManifests(findings) {
  const attestationPath = path.join(OUT, "attestation.json");
  if (fs.existsSync(attestationPath)) {
    const attestation = JSON.parse(fs.readFileSync(attestationPath, "utf8"));
    for (const entry of attestation.attested ?? []) {
      const stage = normalizeStage(entry.stage);
      if (!isStageIncludedInBuild(stage, TIER)) {
        findings.push({
          severity: "critical",
          kind: "stage-leak",
          summary: `attestation.json includes excluded ${stage} file: ${entry.path}`,
          path: entry.path,
          stage,
        });
      }
    }
  }

  const manifestPath = path.join(OUT, "ontology-manifest.json");
  if (fs.existsSync(manifestPath)) {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    for (const artifact of manifest.artifacts ?? []) {
      const stage = normalizeStage(artifact.stage);
      if (isStageIncludedInBuild(stage, TIER)) continue;
      const markedExport = artifact?.transit?.globalExport === true;
      if (markedExport) {
        findings.push({
          severity: "critical",
          kind: "stage-leak",
          summary: `ontology-manifest.json exports excluded ${stage} artifact: ${artifact.ontologyPath || artifact.href}`,
          path: artifact.ontologyPath || artifact.href,
          stage,
        });
        continue;
      }
      // Hardened export redacts paths; bare stage markers are acceptable.
      if (artifact.redacted === true) continue;
      // Unredacted draft rows still teach agents the dark corpus map.
      findings.push({
        severity: "medium",
        kind: "manifest-dark-corpus-map",
        summary: `ontology-manifest.json discloses excluded ${stage} target to recon: ${artifact.ontologyPath || artifact.href || artifact.name}`,
        path: artifact.ontologyPath || artifact.href || artifact.name,
        stage,
      });
    }
  }

  const graphPath = path.join(OUT, ".well-known", "corpus-graph.json");
  if (fs.existsSync(graphPath)) {
    const graph = JSON.parse(fs.readFileSync(graphPath, "utf8"));
    const nodes = graph.interior?.nodes ?? graph.nodes ?? graph.essays ?? [];
    for (const node of nodes) {
      if (!node || typeof node !== "object") continue;
      if (node.stage == null) continue;
      const stage = normalizeStage(node.stage);
      // Graph may retain draft nodes for link targets — fail only when marked published.
      if (!isStageIncludedInBuild(stage, TIER) && node.published === true) {
        findings.push({
          severity: "critical",
          kind: "stage-leak",
          summary: `corpus-graph marks excluded ${stage} node as published: ${node.id || node.path || node.label}`,
          path: String(node.id || node.path || node.label),
          stage,
        });
      }
    }
  }
}

function collectFindings(memory) {
  const findings = [];
  const probeResults = [];

  if (!fs.existsSync(OUT)) {
    findings.push({
      severity: "critical",
      kind: "missing-export",
      summary: "out/ missing — cannot stress-test recon surface",
    });
    return { findings, probeResults, publicPaths: [], surfaceHash: null };
  }

  for (const surface of INTENTIONAL_SURFACES) {
    if (!outExists(surface)) {
      findings.push({
        severity: "critical",
        kind: "missing-intentional-door",
        summary: `Intentional agent door missing: ${surface}`,
        path: surface,
      });
    }
  }

  const discovery = readDiscoveryDocs();
  const advertised = `${discovery.sitemap}\n${discovery.openapi}\n${discovery.robots}`;

  for (const family of RECON_PLAYBOOK) {
    for (const probe of family.probes) {
      const present = probe.expectPresence != null ? outExists(probe.path) : null;
      const advertisedHit =
        probe.mustNotAdvertise === true &&
        advertised.toLowerCase().includes(probe.path.replace(/\/$/, "").toLowerCase());

      probeResults.push({
        family: family.id,
        path: probe.path,
        present,
        expectPresence: probe.expectPresence ?? null,
        mustNotAdvertise: Boolean(probe.mustNotAdvertise),
        advertisedHit,
        agentBias: family.agentBias,
      });

      const statKey = `${family.id}:${probe.path}`;
      const stat = memory.probeStats[statKey] ?? {
        family: family.id,
        path: probe.path,
        expectPresence: probe.expectPresence ?? null,
        mustNotAdvertise: Boolean(probe.mustNotAdvertise),
        seen: 0,
        hits: 0,
        misses: 0,
        advertisedHits: 0,
      };
      stat.seen += 1;
      if (present === true) stat.hits += 1;
      if (present === false) stat.misses += 1;
      if (advertisedHit) stat.advertisedHits += 1;
      stat.lastPresent = present;
      stat.lastAdvertisedHit = advertisedHit;
      stat.lastSeenAt = NOW;
      memory.probeStats[statKey] = stat;

      if (present === true && probe.expectPresence === false) {
        findings.push({
          severity: "critical",
          kind: "hostile-probe-hit",
          summary: `Recon probe hit unexpected export: ${probe.path}`,
          path: probe.path,
          family: family.id,
          agentBias: family.agentBias,
        });
      }
      if (present === false && probe.expectPresence === true) {
        findings.push({
          severity: "high",
          kind: "missing-intentional-door",
          summary: `Expected discovery surface absent: ${probe.path}`,
          path: probe.path,
          family: family.id,
        });
      }
      if (advertisedHit) {
        findings.push({
          severity: "critical",
          kind: "dark-route-advertised",
          summary: `Dark route advertised in discovery docs: ${probe.path}`,
          path: probe.path,
          family: family.id,
          agentBias: family.agentBias,
        });
      }
    }
  }

  if (discovery.robots.toLowerCase().includes("disallow:")) {
    findings.push({
      severity: "info",
      kind: "robots-disallow-map",
      summary: "robots.txt contains Disallow rules — agents treat these as recon hints",
    });
  }

  const maps = walkFiles(OUT).filter((f) => f.endsWith(".map"));
  if (maps.length > 0) {
    findings.push({
      severity: "high",
      kind: "source-maps-exported",
      summary: `${maps.length} source map(s) present in export (aid reverse-engineering)`,
      samples: maps.slice(0, 5).map((f) => publicUrlFromOutFile(f)),
    });
  }

  const textFiles = walkFiles(OUT).filter((f) =>
    PUBLIC_TEXT_EXTS.has(path.extname(f).toLowerCase()),
  );
  for (const file of textFiles) {
    const rel = path.relative(OUT, file).split(path.sep).join("/");
    if (rel.startsWith("__p3/")) continue;
    let body;
    try {
      body = fs.readFileSync(file, "utf8");
    } catch {
      continue;
    }
    if (body.length > 1_500_000) continue;
    for (const pattern of SECRET_PATTERNS) {
      if (pattern.re.test(body)) {
        findings.push({
          severity: "critical",
          kind: "secret-pattern",
          summary: `Secret-like pattern (${pattern.id}) in ${rel}`,
          path: `/${rel}`,
        });
      }
    }
  }

  checkStageManifests(findings);

  const publicPaths = discoverPublicPaths();
  const surfaceHash = createHash("sha256").update(publicPaths.join("\n"), "utf8").digest("hex");

  return { findings, probeResults, publicPaths, surfaceHash };
}

function applyLearning(memory, { findings, probeResults, publicPaths, surfaceHash }) {
  const previous = new Set(memory.knownPublicPaths ?? []);
  const current = new Set(publicPaths);
  const novel = publicPaths.filter((p) => !previous.has(p));
  const vanished = [...previous].filter((p) => !current.has(p));

  if (previous.size > 0) {
    for (const p of novel) {
      findings.push({
        severity: "medium",
        kind: "novel-public-path",
        summary: `Novel public path since last remembered build: ${p}`,
        path: p,
      });
      rememberLesson(memory, {
        kind: "surface-growth",
        summary: `Agents will rediscover new public path ${p} via sitemap/OpenAPI`,
        path: p,
      });
    }
    for (const p of vanished) {
      rememberLesson(memory, {
        kind: "surface-shrink",
        summary: `Path vanished from export; stale agent indexes may 404: ${p}`,
        path: p,
      });
    }
  }

  for (const family of RECON_PLAYBOOK) {
    rememberLesson(memory, {
      kind: "agent-bias",
      summary: family.agentBias,
      family: family.id,
    });
  }

  for (const finding of findings) {
    if (finding.severity === "info") continue;
    rememberLesson(memory, {
      kind: finding.kind,
      summary: finding.summary,
      path: finding.path,
      severity: finding.severity,
    });
  }

  const darkMisses = probeResults.filter((p) => p.expectPresence === false && p.present === false);
  if (darkMisses.length > 0) {
    rememberLesson(memory, {
      kind: "dark-equilibrium",
      summary: `${darkMisses.length} hostile recon probes remain dark in this export`,
    });
  }

  const unadvertised = probeResults.filter((p) => p.mustNotAdvertise && !p.advertisedHit);
  if (unadvertised.length > 0) {
    rememberLesson(memory, {
      kind: "advertising-discipline",
      summary: `${unadvertised.length} dark prefixes stay out of sitemap/OpenAPI/robots`,
    });
  }

  memory.updatedAt = NOW;
  memory.builds = (memory.builds ?? 0) + 1;
  memory.knownPublicPaths = publicPaths;
  memory.intentionalSurfaces = INTENTIONAL_SURFACES;
  memory.history = [
    {
      at: NOW,
      tier: TIER,
      surfaceHash,
      publicPathCount: publicPaths.length,
      findingCounts: countBySeverity(findings),
      novelPathCount: novel.length,
      vanishedPathCount: vanished.length,
      probeHits: probeResults.filter((p) => p.present === true).length,
      probeTotal: probeResults.length,
    },
    ...(memory.history ?? []),
  ].slice(0, HISTORY_LIMIT);

  return { novel, vanished };
}

function countBySeverity(findings) {
  const counts = { critical: 0, high: 0, medium: 0, info: 0 };
  for (const f of findings) {
    counts[f.severity] = (counts[f.severity] ?? 0) + 1;
  }
  return counts;
}

function printReport({ findings, publicPaths, novel, vanished, memory }) {
  const counts = countBySeverity(findings);
  console.log(
    `recon-defense: tier=${TIER} paths=${publicPaths.length} builds=${memory.builds} ` +
      `findings={critical:${counts.critical},high:${counts.high},medium:${counts.medium},info:${counts.info}}`,
  );
  if (novel.length) console.log(`recon-defense: novel paths: ${novel.join(", ")}`);
  if (vanished.length) console.log(`recon-defense: vanished paths: ${vanished.join(", ")}`);

  const recentLessons = (memory.lessons ?? []).slice(0, 5);
  if (recentLessons.length) {
    console.log("recon-defense: recent lessons:");
    for (const lesson of recentLessons) {
      console.log(`  - [${lesson.kind}] ${lesson.summary}`);
    }
  }

  for (const f of findings.filter((x) => x.severity !== "info")) {
    console.error(`recon-defense: ${f.severity.toUpperCase()} ${f.summary}`);
  }
}

function main() {
  const memory = loadMemory();
  const collected = collectFindings(memory);
  const { novel, vanished } = applyLearning(memory, collected);
  printReport({
    findings: collected.findings,
    publicPaths: collected.publicPaths,
    novel,
    vanished,
    memory,
  });

  if (!DRY_RUN) {
    fs.mkdirSync(path.dirname(MEMORY_PATH), { recursive: true });
    fs.writeFileSync(MEMORY_PATH, `${JSON.stringify(memory, null, 2)}\n`, "utf8");
    console.log(`recon-defense: memory → ${path.relative(ROOT, MEMORY_PATH)}`);
  } else {
    console.log("recon-defense: dry-run — memory not written");
  }

  const counts = countBySeverity(collected.findings);
  if (counts.critical > 0 || counts.high > 0) {
    failHard(`${counts.critical} critical / ${counts.high} high finding(s) — build refused`);
  }

  console.log("recon-defense: OK — hostile probes dark, intentional doors present, memory updated");
}

main();
