"use client";
import { motion, useReducedMotion } from "framer-motion";
export default function ScrollFloat({ children }: { children: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.span
      className="scroll-float-text"
      initial={reduce ? false : { opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.span>
  );
}
