"use client";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
const Cubes = dynamic(
  () => import("./ui/background-cubes-grid").then((m) => m.BackgroundCubesGrid),
  { ssr: false },
);
// Aceternity's real WebGL cube field, scoped to the welcome panel.
export function BackgroundCubesGridDemo() {
  const ref = useRef<HTMLDivElement>(null);
  const [enabled, setEnabled] = useState(false);
  const reduce = useReducedMotion();
  useEffect(() => {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("webgl2");
    if (!context) return;
    context.getExtension("WEBGL_lose_context")?.loseContext();
    let visible = false;
    const update = () => setEnabled(visible && !document.hidden);
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      update();
    });
    if (ref.current) observer.observe(ref.current);
    document.addEventListener("visibilitychange", update);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  return (
    <div ref={ref} className="welcome-cubes" aria-hidden="true">
      {enabled && reduce === false && (
        <Cubes
          cellSize={65}
          gap={0.035}
          topColor="#222b48"
          leftColor="#151c33"
          rightColor="#101729"
          glowColor="#7187ee"
          glow={0.3}
          amplitude={0.35}
          idleDelay={4}
        />
      )}
    </div>
  );
}
