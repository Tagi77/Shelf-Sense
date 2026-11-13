"use client";
import { motion } from "framer-motion";
import { useId } from "react";
export default function AnimatedSelector({
  id,
  value,
  options,
  onChange,
}: {
  id: string;
  value: string;
  options: { value: string; label: string; detail?: string }[];
  onChange: (value: string) => void;
}) {
  const uid = useId();
  return (
    <div
      id={id}
      className="parameter-options"
      role="group"
      aria-labelledby={`${id}-label`}
    >
      {options.map((o) => (
        <motion.button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          whileTap={{ scale: 0.98 }}
        >
          {o.value === value && (
            <motion.span className="selected-pill" layoutId={uid} />
          )}
          <span>
            {o.label}
            {o.detail && <small>{o.detail}</small>}
          </span>
        </motion.button>
      ))}
    </div>
  );
}
