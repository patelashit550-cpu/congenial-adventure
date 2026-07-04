"use client";

import type { CSSProperties } from "react";
import { useLayoutEffect, useRef, useState, useEffect, useCallback } from "react";

import { BentoCard } from "./BentoCard";
import { BentoRegistry } from "@/config/site";
import type { BentoKey, NavVisibilityPayload } from "@/lib/nav-visibility-shared";
import { cn } from "@/lib/utils";

const MD_MIN = 768;
const WIDE_MQ = `(min-width: ${MD_MIN}px)`;

type Props = { visible: NavVisibilityPayload };

/**
 * `md+`: all three card frames share one height: the **tallest** natural column
 * (content-driven only — no extra viewport min, so the row doesn’t sit mostly empty
 * under shorter lists). Inner overflow still uses `.bento-nav-scroller`.
 */
export function BentoHomeEqualRows({ visible }: Props) {
  const frameRefs = useRef<(HTMLDivElement | null)[]>([null, null, null]);
  const [rowPx, setRowPx] = useState<number | null>(null);
  const [layoutPass, setLayoutPass] = useState(0);
  
  /** SSR + first client tick match `false` so markup hydrates; `useLayout` syncs to `matchMedia`. */
  const [isWide, setIsWide] = useState(false);
  
  /** Prevents layout flashes and guarantees server/client markup match during initial hydration step. */
  const [mounted, setMounted] = useState(false);
  
  const visKey = JSON.stringify(visible);

  const measureTallestFrame = useCallback((): void => {
    const els = frameRefs.current;
    if (els.length !== 3 || els.some((e) => e == null)) return;
    const hs = els.map((el) => Math.ceil(el!.getBoundingClientRect().height));
    if (hs.some((h) => h < 1)) return;
    const h = Math.max(hs[0]!, hs[1]!, hs[2]!);
    setRowPx((p) => (p === h ? p : h));
  }, []);

  // Track initial client mount
  useEffect(() => {
    setMounted(true);
  }, []);

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    const m = window.matchMedia(WIDE_MQ);
    setIsWide(m.matches);
    const onM = () => {
      setIsWide(m.matches);
      if (!m.matches) {
        setRowPx(null);
        return;
      }
      setLayoutPass((n) => n + 1);
    };
    m.addEventListener("change", onM);
    return () => m.removeEventListener("change", onM);
  }, []);

  useLayoutEffect(() => {
    if (!isWide) {
      setRowPx(null);
      return;
    }

    measureTallestFrame();

    let cancelled = false;
    let raf0 = 0;
    let raf1 = 0;
    raf0 = requestAnimationFrame(() => {
      if (cancelled) return;
      measureTallestFrame();
      raf1 = requestAnimationFrame(() => {
        if (!cancelled) measureTallestFrame();
      });
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf0);
      cancelAnimationFrame(raf1);
    };
  }, [isWide, visKey, layoutPass, measureTallestFrame]);

  useLayoutEffect(() => {
    if (!isWide) return;
    const seen = new Set<HTMLDivElement>();
    for (const el of frameRefs.current) {
      if (el) seen.add(el);
    }
    if (seen.size < 1) return;

    const ro = new ResizeObserver(() => {
      measureTallestFrame();
    });
    for (const el of seen) {
      ro.observe(el);
    }
    return () => {
      ro.disconnect();
    };
  }, [isWide, visKey, measureTallestFrame]);

  useEffect(() => {
    if (!isWide) return;
    const onResize = () => {
      setRowPx(null);
      setLayoutPass((n) => n + 1);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [isWide]);

  useEffect(() => {
    if (typeof document === "undefined" || !isWide) return;
    void document.fonts?.ready?.then?.(() => setLayoutPass((n) => n + 1));
  }, [isWide, visKey]);

  // Only equalize if components are mounted on the client AND matching wide criteria
  const isEqual = mounted && isWide && rowPx != null;

  return (
    <div
      className={cn(
        "bento-container bento-container--home w-full",
        isEqual && "bento-container--home-equal"
      )}
    >
      {(Object.keys(BentoRegistry) as BentoKey[]).map((key, index) => {
        const section = BentoRegistry[key];
        const newByHref = new Map(
          visible[key].map((v) => [v.href, v.isNew === true] as const)
        );
        const allowedHrefs = new Set(visible[key].map((v) => v.href));
        const items = section.series
          .filter((item) => allowedHrefs.has(item.href as string))
          .map((item) => {
            const href = item.href as string;
            return {
              label: item.name,
              sublabel: item.desc,
              href,
              isNew: newByHref.get(href) === true,
            };
          });

        const frameStyle: CSSProperties | undefined =
          isEqual && rowPx != null
            ? { height: rowPx, minHeight: 0, maxHeight: rowPx, boxSizing: "border-box" as const }
            : undefined;

        return (
          <div
            key={key}
            ref={(el) => {
              frameRefs.current[index] = el;
            }}
            className="bento-home-card-frame min-w-0 min-h-0 flex flex-col"
            style={frameStyle}
          >
            <BentoCard
              equalRow={isEqual}
              nodeKicker={section.nodeKicker}
              nodeId={section.label}
              title={section.title}
              subtitle={section.subtitle}
              titleVisualSrc={section.titleVisualSrc}
              titleVisualAlt={section.titleVisualAlt}
              items={items}
            />
          </div>
        );
      })}
    </div>
  );
}