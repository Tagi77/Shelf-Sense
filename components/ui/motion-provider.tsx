"use client";
import { MotionConfig } from "framer-motion";
export const spring = { type: "spring" as const, stiffness: 380, damping: 30 };
export default function MotionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <MotionConfig reducedMotion="user" transition={spring}>
      {children}
    </MotionConfig>
  );
}
