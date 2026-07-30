import type { EssayStub } from "@/lib/markdown";
import { BentoRegistry } from "@/config/site";

export type ContentHubKey =
  | "chronicle/jack-london"
  | "chronicle/polite_bureau"
  | "governance/capital"
  | "governance/dial-square"
  | "governance/identity"
  | "governance/intelligence"
  | "governance/peridot";

/** Pillar group on a composite hub (Semper Idem) — essays nest under the hub URL. */
export type ContentHubPillar = {
  /** Series title shown in the left nav (e.g. Sine Qua Non). */
  kicker: string;
  /** Pillar role under the series title (e.g. Intelligence). */
  subtitle?: string;
  publicBase: readonly string[];
  ontologyTopicPath: readonly string[];
  seriesSlug?: string;
};

type FolderHubConfig = {
  mode: "folder";
  ontologyTopicPath: readonly string[];
  /** When set, only essays in the folder with matching `series` frontmatter are listed. */
  seriesSlug?: string;
};

type SeriesHubConfig = {
  mode: "series";
  seriesName: string;
  landerOntologyRel: string;
};

export type ContentHubConfig = {
  publicBase: readonly string[];
  navKicker: string;
  /** Optional line under the series kicker (e.g. Regnum Dei → The Restful State). */
  navKickerSubtitle?: string;
  landerSlug: string;
  /** When true, hub index (`/…/peridot/`) opens the latest essay by `publishedAt`. */
  hubLanding?: "latest" | "lander" | "first";
  /** When true, left nav shows 01/02… prefixes (EPU, SI, SQN). */
  sequentialNav?: boolean;
  /** When true, left nav shows a publication date stamp per essay. */
  showNavDate?: boolean;
  /** When true with {@link showNavDate}, sort nav oldest → newest. */
  navChronological?: boolean;
  /**
   * Dial Square–style map: left nav groups linking out to pillar hubs.
   * Hub itself only hosts the lander (and any folder essays under publicBase).
   */
  navPillars?: readonly ContentHubPillar[];
} & (FolderHubConfig | SeriesHubConfig);

export const CONTENT_HUBS: Record<ContentHubKey, ContentHubConfig> = {
  "chronicle/jack-london": {
    publicBase: ["chronicle", "jack-london"],
    navKicker: "BIOGRAPHY",
    landerSlug: "jack-london",
    mode: "folder",
    ontologyTopicPath: ["narrative", "biography"],
    seriesSlug: "the times",
  },
  "chronicle/polite_bureau": {
    publicBase: ["chronicle", "polite_bureau"],
    navKicker: "COMMENT",
    landerSlug: "polite-bureau",
    mode: "series",
    seriesName: "Polite Bureau",
    landerOntologyRel: "narrative/comment/polite-bureau",
    showNavDate: true,
    navChronological: true,
  },
  "governance/dial-square": {
    publicBase: ["governance", "dial-square"],
    navKicker: "REGNUM DEI",
    navKickerSubtitle: "Restful State",
    landerSlug: "semantic-perimeter",
    hubLanding: "lander",
    mode: "folder",
    ontologyTopicPath: ["governance", "identity"],
    seriesSlug: "dial square",
    navPillars: [
      {
        kicker: "Sine Qua Non",
        subtitle: "Intelligence",
        publicBase: ["governance", "intelligence"],
        ontologyTopicPath: ["governance", "intelligence"],
      },
      {
        kicker: "Dial Square",
        subtitle: "Identity",
        publicBase: ["governance", "identity"],
        ontologyTopicPath: ["governance", "identity"],
        seriesSlug: "dial square",
      },
      {
        kicker: "E Pluribus Unum",
        subtitle: "Capital",
        publicBase: ["governance", "capital"],
        ontologyTopicPath: ["governance", "capital"],
      },
    ],
  },
  "governance/identity": {
    publicBase: ["governance", "identity"],
    navKicker: "IDENTITY",
    landerSlug: "dial-square",
    mode: "folder",
    ontologyTopicPath: ["governance", "identity"],
    seriesSlug: "dial square",
    sequentialNav: true,
  },
  "governance/capital": {
    publicBase: ["governance", "capital"],
    navKicker: "CAPITAL",
    landerSlug: "capital",
    mode: "folder",
    ontologyTopicPath: ["governance", "capital"],
    sequentialNav: true,
  },
  "governance/intelligence": {
    publicBase: ["governance", "intelligence"],
    navKicker: "INTELLIGENCE",
    landerSlug: "intelligence",
    mode: "folder",
    ontologyTopicPath: ["governance", "intelligence"],
    sequentialNav: true,
  },
  "governance/peridot": {
    publicBase: ["governance", "peridot"],
    navKicker: "ILLUMINATION",
    landerSlug: "peridot",
    hubLanding: "latest",
    mode: "folder",
    ontologyTopicPath: ["governance", "illumination"],
    seriesSlug: "peridot",
  },
};

export type ContentHubRoute = {
  kind: "content-hub";
  hubKey: ContentHubKey;
  config: ContentHubConfig;
  /** `null` on hub index (`/governance/peridot/`). */
  essaySlug: string | null;
};

export type LegacyContentRoute = {
  kind: "legacy";
  topicPath: string[];
  activeSlug: string;
  isMeRoute: boolean;
};

export type ContentRoute = ContentHubRoute | LegacyContentRoute;

function hubKeyFromSlug(parts: string[]): ContentHubKey | null {
  if (parts.length < 2) return null;
  const key = `${parts[0]}/${parts[1]}` as ContentHubKey;
  return key in CONTENT_HUBS ? key : null;
}

export function resolveContentRoute(slug: string[]): ContentRoute | null {
  const parts = slug.filter(Boolean);
  if (parts.length < 2) return null;

  const hubKey = hubKeyFromSlug(parts);
  if (hubKey) {
    return {
      kind: "content-hub",
      hubKey,
      config: CONTENT_HUBS[hubKey],
      essaySlug: parts.length > 2 ? parts[2]! : null,
    };
  }

  return {
    kind: "legacy",
    topicPath: parts.slice(0, -1),
    activeSlug: parts[parts.length - 1]!,
    isMeRoute: parts[0] === "me",
  };
}

export function listContentHubStaticParams(
  listFolderEssays: (topicPath: string[], seriesSlug?: string) => EssayStub[],
  listSeriesEssays: (seriesName: string) => EssayStub[]
): { slug: string[] }[] {
  const out: { slug: string[] }[] = [];

  for (const config of Object.values(CONTENT_HUBS)) {
    const base = [...config.publicBase];
    out.push({ slug: base });

    const seen = new Set<string>();
    const addEssay = (essaySlug: string) => {
      if (seen.has(essaySlug)) return;
      seen.add(essaySlug);
      out.push({ slug: [...base, essaySlug] });
    };

    if (config.landerSlug) addEssay(config.landerSlug);

    const essays =
      config.mode === "folder"
        ? listFolderEssays([...config.ontologyTopicPath], config.seriesSlug)
        : listSeriesEssays(config.seriesName);

    for (const essay of essays) {
      addEssay(essay.slug);
    }

    if (config.navPillars) {
      for (const pillar of config.navPillars) {
        for (const essay of listFolderEssays([...pillar.ontologyTopicPath], pillar.seriesSlug)) {
          addEssay(essay.slug);
        }
      }
    }
  }

  return out;
}

/**
 * Static params for bento links outside {@link CONTENT_HUBS} — e.g. `/me/origins`, `/governance/carta`.
 * Hub landers + hub essays are handled by {@link listContentHubStaticParams}.
 */
export function listBentoLegacyStaticParams(
  listMeEssays: () => EssayStub[],
  resolveEssay: (slugParts: string[]) => { frontmatter: Record<string, unknown> } | null,
  isStageIncluded: (stage: unknown) => boolean
): { slug: string[] }[] {
  const out: { slug: string[] }[] = [];
  const seen = new Set<string>();

  const add = (parts: string[]) => {
    const key = parts.join("/");
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ slug: parts });
  };

  for (const essay of listMeEssays()) {
    add(["me", essay.slug]);
  }

  for (const section of Object.values(BentoRegistry)) {
    for (const item of section.series) {
      const rel = item.href.replace(/^\//, "");
      if (rel in CONTENT_HUBS) continue;
      const parts = rel.split("/");
      const essay = resolveEssay(parts);
      if (!essay) continue;
      if (!isStageIncluded(essay.frontmatter.stage)) continue;
      add(parts);
    }
  }

  return out;
}

/** @deprecated Use CONTENT_HUBS */
export const CHRONICLE_HUBS = CONTENT_HUBS;
export type ChronicleHubRoute = ContentHubRoute;
