"use client";

import { useEffect, useRef } from "react";

import sundialUrl from "@/assets/sundial_letters_outer.svg";

export function CompassWatermark() {
  const ref = useRef<HTMLDivElement>(null);
  const src = typeof sundialUrl === "string" ? sundialUrl : sundialUrl.src;

  useEffect(() => {
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
  }, []);

  return (
    <div ref={ref} className="p3-compass-watermark" aria-hidden="true">
      <img src={src} alt="" />
    </div>
  );
}
