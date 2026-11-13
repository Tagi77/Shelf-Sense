"use client";
import { useRef } from "react";
export function MagicCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={ref}
      className={`magic-card ${className}`}
      onPointerMove={(e) => {
        if (e.pointerType !== "mouse") return;
        const r = e.currentTarget.getBoundingClientRect();
        ref.current?.style.setProperty("--glow-x", `${e.clientX - r.left}px`);
        ref.current?.style.setProperty("--glow-y", `${e.clientY - r.top}px`);
      }}
    >
      <div className="magic-light" aria-hidden="true" />
      {children}
    </div>
  );
}
