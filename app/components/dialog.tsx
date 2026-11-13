"use client";
import { useEffect, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
export default function Dialog({
  children,
  open = true,
  title,
  onClose,
  closeLabel = "Закрыть",
  className = "",
}: {
  children: React.ReactNode;
  open?: boolean;
  title: string;
  onClose: () => void;
  closeLabel?: string;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDialogElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.body.style.overflow;
    if (!open) {
      dialog?.close();
      return;
    }
    dialog?.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog?.close();
      document.body.style.overflow = previous;
    };
  }, [open]);
  return (
    <motion.dialog
      initial={reduce ? false : { opacity: 0, y: 18, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      ref={ref}
      className={`modal ${className}`}
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        closeRef.current();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          const r = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < r.left ||
            event.clientX > r.right ||
            event.clientY < r.top ||
            event.clientY > r.bottom
          )
            closeRef.current();
        }
      }}
    >
      <div className="modal-heading">
        <h2>{title}</h2>
        <button
          type="button"
          className="icon-button"
          aria-label={closeLabel}
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </motion.dialog>
  );
}
