"use client";
import { Children, useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Pause, Play, ChevronLeft, ChevronRight } from "lucide-react";
export function AnimatedList({
  children,
  stackGap = 15,
  scaleFactor = 0.04,
  scrollDownDuration = 5,
  formationDuration = 0.5,
  lang = "ru",
}: {
  children: React.ReactNode;
  stackGap?: number;
  columnGap?: number;
  scaleFactor?: number;
  scrollDownDuration?: number;
  formationDuration?: number;
  lang?: "ru" | "en";
}) {
  const items = Children.toArray(children);
  const [index, setIndex] = useState(0),
    [paused, setPaused] = useState(true),
    [hover, setHover] = useState(false);
  const reduce = useReducedMotion();
  useEffect(() => {
    if (paused || hover || reduce || items.length < 2) return;
    const timer = setInterval(() => {
      if (!document.hidden) setIndex((i) => (i + 1) % items.length);
    }, scrollDownDuration * 1000);
    return () => clearInterval(timer);
  }, [paused, hover, reduce, items.length, scrollDownDuration]);
  const current = index % Math.max(1, items.length),
    l = (ru: string, en: string) => (lang === "ru" ? ru : en);
  return (
    <div
      className="animated-notifications"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocusCapture={() => setHover(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setHover(false);
      }}
    >
      <div className="notification-stack">
        {[2, 1].map(
          (depth) =>
            items.length > depth && (
              <div
                key={depth}
                className="notification-back"
                aria-hidden="true"
                style={{
                  transform: `translateY(${stackGap * depth}px) scale(${1 - scaleFactor * depth})`,
                }}
              />
            ),
        )}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            className="notification-front"
            key={
              items[current] &&
              typeof items[current] === "object" &&
              "key" in items[current]
                ? String(items[current].key)
                : current
            }
            initial={reduce ? false : { y: -18, opacity: 0, scale: 0.97 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { y: 22, opacity: 0, scale: 0.96 }}
            transition={{ duration: reduce ? 0 : formationDuration }}
          >
            {items[current]}
          </motion.div>
        </AnimatePresence>
      </div>
      {items.length > 0 && (
        <div className="notification-player">
          <button
            onClick={() => {
              setPaused(true);
              setIndex((i) => (i - 1 + items.length) % items.length);
            }}
            aria-label={l("Предыдущее сообщение", "Previous message")}
          >
            <ChevronLeft size={17} />
          </button>
          <span>
            {current + 1} / {items.length}
          </span>
          <button
            onClick={() => {
              setPaused(true);
              setIndex((i) => (i + 1) % items.length);
            }}
            aria-label={l("Следующее сообщение", "Next message")}
          >
            <ChevronRight size={17} />
          </button>
          {!reduce && (
            <button
              onClick={() => setPaused(!paused)}
              aria-label={
                paused
                  ? l("Продолжить сообщения", "Resume messages")
                  : l("Остановить сообщения", "Pause messages")
              }
            >
              {paused ? <Play size={16} /> : <Pause size={16} />}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
