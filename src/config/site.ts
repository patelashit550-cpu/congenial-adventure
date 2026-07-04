// src/config/site.ts

/**
 * SiteIdentity: High-level metadata for the Planet-III project.
 * Aligned with the Header tagline for system consistency.
 */
export const SiteIdentity = {
  name: 'Transition Insight',
  description: 'HUMAN-CENTRIC GOVERNANCE FOR A NEW EARTH',
  url: 'https://transition-insight.com',
  icon: '/visuals/icon.png',
};

/**
 * Mobile Safeguards: Viewport constants to map into Root Layouts or UI wrappers.
 * Prevents fixed pixel truncation on high-density devices like the Galaxy S24.
 */
export const LayoutConfig = {
  contentShellMaxWidth: 'max-w-6xl', // Desktop maximum boundary
  mobileShellWidth: 'w-full',        // Liquid fluid scaling for smartphones
  textWrappingClasses: 'break-words whitespace-normal overflow-wrap-anywhere',
};

export type BentoSeriesItem = {
  name: string;
  desc: string;
  dataPoint: string;
  href: string;
};

export type BentoSectionConfig = {
  title: string;
  label: string;
  /** Devanagari kicker paired with Latin `label` (Veritas / Utilitas / Firmitas). */
  nodeKicker: string;
  subtitle: string;
  status: string;
  /** When true, routes under this bento may require a signed-in session (auth TBD). */
  requiresAuth: boolean;
  series: BentoSeriesItem[];
  titleVisualSrc?: string;
  titleVisualAlt?: string;
};

/**
 * BentoRegistry: The Primary Content Map.
 */
export const BentoRegistry: Record<"B1" | "B2" | "B3", BentoSectionConfig> = {
  B1: {
    title: "Ashit Milne",
    label: "Veritas",
    nodeKicker: "सत्यम",
    subtitle: "Identity",
    status: "NODE_ACTIVE // 001",
    requiresAuth: false,
    titleVisualSrc: "/visuals/bento-rose-emerald.png",
    titleVisualAlt: "Rose — Veritas",
    series: [
      { name: "Origins", desc: "अर्थ — On Earth", dataPoint: "0xAF1", href: "/me/origins" },
      { name: "Trials of Job", desc: "気 - Key Flows", dataPoint: "0xAF2", href: "/me/trials-of-job" },
      { name: "In Praxis", desc: "योग — Come Together", dataPoint: "0xAF3", href: "/me/praxis" },
      { name: "Connexion", desc: "Phone Jack", dataPoint: "0xAF4", href: "/me/connexion" },
    ],
  },
  B2: {
    title: "Regnum Dei",
    label: "Utilitas",
    nodeKicker: "शिवम",
    subtitle: "Anarchy As Governance",
    status: "NODE_STABLE // 002",
    requiresAuth: false,
    titleVisualSrc: "/visuals/bento-gem-emerald.png",
    titleVisualAlt: "Gem — Utilitas",
    series: [
      { name: "Carta", desc: "Canon", dataPoint: "0xBF5", href: "/governance/carta" },
      { name: "Semper Idem", desc: "Identity", dataPoint: "0xBF1", href: "/governance/identity" },
      { name: "E Pluribus Unum", desc: "Capital", dataPoint: "0xBF3", href: "/governance/capital" },
      { name: "Sine Qua Non", desc: "Intelligence", dataPoint: "0xBF2", href: "/governance/intelligence" },
      { name: "Peridot", desc: "Terms & Conditions", dataPoint: "0xBF4", href: "/governance/peridot" },
    ],
  },
  B3: {
    title: "Telamon",
    label: "Firmitas",
    nodeKicker: "सुन्दरम",
    subtitle: "Jackanory: The Tangent",
    status: "SIGNAL_LIVE // 003",
    requiresAuth: false,
    titleVisualSrc: "/visuals/bento-lion-emerald.png",
    titleVisualAlt: "Lion — The Times",
    series: [
      { name: "The Times", desc: "By Jack London", dataPoint: "0xCF1", href: "/chronicle/jack-london" },
      { name: "Polite Bureau", desc: "Commentary", dataPoint: "0xCF3", href: "/chronicle/polite_bureau" },
    ],
  },
};