"use client";
import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
export function AnimatedThemeToggler({ lang = "ru" }: { lang?: "ru" | "en" }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const switching = useRef(false);
  useEffect(() => setMounted(true), []);
  const dark = mounted && resolvedTheme === "dark";
  async function toggle() {
    if (switching.current) return;
    const update = () => flushSync(() => setTheme(dark ? "light" : "dark"));
    if (
      !document.startViewTransition ||
      matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      update();
      return;
    }
    switching.current = true;
    try {
      const rect = button.current!.getBoundingClientRect(),
        x = rect.x + rect.width / 2,
        y = rect.y + rect.height / 2;
      const radius = Math.hypot(
        Math.max(x, innerWidth - x),
        Math.max(y, innerHeight - y),
      );
      const transition = document.startViewTransition(update);
      await transition.ready;
      await document.documentElement.animate(
        {
          clipPath: [
            `circle(0px at ${x}px ${y}px)`,
            `circle(${radius}px at ${x}px ${y}px)`,
          ],
        },
        {
          duration: 450,
          easing: "ease-in-out",
          pseudoElement: "::view-transition-new(root)",
        },
      ).finished;
    } catch {
      /* Theme still changes if the browser skips the transition. */
    } finally {
      switching.current = false;
    }
  }
  const label =
    lang === "ru"
      ? dark
        ? "Светлая тема"
        : "Ночная тема"
      : dark
        ? "Light mode"
        : "Dark mode";
  return (
    <button
      ref={button}
      type="button"
      className="icon-button theme-button"
      onClick={toggle}
      aria-label={label}
      title={label}
    >
      {dark ? <Sun size={19} /> : <Moon size={19} />}
    </button>
  );
}
