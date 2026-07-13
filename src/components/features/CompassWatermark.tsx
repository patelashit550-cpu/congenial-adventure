"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import sundialUrl from "@/assets/sundial_letters_outer.svg";

export function CompassWatermark() {
  const ref = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const el = ref.current;
    if (!el) return;

    function onMove(e: MouseEvent) {
      const r = el!.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dist = Math.hypot(e.clientX - cx, e.clientY - cy);
      el!.classList.toggle("is-revealed", dist < r.width * 0.75);
    }

    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [mounted]);

  if (!mounted) return null;

  const src = typeof sundialUrl === "string" ? sundialUrl : sundialUrl.src;

  return createPortal(
    <div ref={ref} className="p3-compass-watermark" aria-hidden="true">
      <img src={src} alt="" />
    </div>,
    document.body,
  );
}
