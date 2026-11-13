"use client";
import { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowUpRight,
  Plus,
  Refrigerator,
  Snowflake,
  Package,
  Thermometer,
} from "lucide-react";
import FolderArt, { type ArtRecipe } from "./glass-folder-art";
import FoodImage from "@/app/components/food-image";
export type FolderFile = {
  name: string;
  meta?: string;
  image?: string;
  id?: string;
};
const arts: ArtRecipe[] = [
  {
    style: "streak",
    colors: ["#17224c", "#5267eb", "#cbd5ff", "#6372be", "#1b2556"],
    angle: -0.6,
    gloss: 0.3,
  },
  {
    style: "marble",
    colors: ["#26253c", "#80789b", "#e1dce9", "#847d97", "#2e314c"],
    warp: 2.4,
    gloss: 0.3,
  },
  {
    style: "streak",
    colors: ["#333e63", "#8397c2", "#edf2ff", "#c1cde2", "#66769d"],
    angle: 0.4,
    gloss: 0.2,
  },
  {
    style: "marble",
    colors: ["#393240", "#927a67", "#e2c3a3", "#a18b80", "#3f3d50"],
    warp: 2,
    gloss: 0.25,
  },
];
export default function GlassFolder({
  label,
  meta,
  files = [],
  onFileSelect,
  onOpen,
  onAdd,
  active = false,
  index = 0,
  lang = "ru",
}: {
  label: string;
  meta?: string;
  files?: FolderFile[];
  onFileSelect?: (f: FolderFile, i: number) => void;
  onOpen?: () => void;
  onAdd?: () => void;
  active?: boolean;
  index?: number;
  lang?: "ru" | "en";
}) {
  const [open, setOpen] = useState(false),
    [width, setWidth] = useState(230);
  const ref = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();
  const reduce = useReducedMotion();
  const Icon =
    [Refrigerator, Thermometer, Snowflake, Package][index] ?? Package;
  const l = (ru: string, en: string) => (lang === "ru" ? ru : en);
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.min(280, entry.contentRect.width)),
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return (
    <article className={`storage-folder ${active ? "active" : ""}`}>
      <div className="storage-folder-heading">
        <span>
          <Icon size={17} />
          {label}
        </span>
        <button
          onClick={onAdd}
          aria-label={l(`Добавить продукт: ${label}`, `Add food: ${label}`)}
        >
          <Plus size={18} />
        </button>
      </div>
      <div className="folder-art-space" ref={ref}>
        <FolderArt
          key={JSON.stringify(files)}
          label={["+2°C … +7°C", "0°C … +2°C", "−18°C", "+15°C … +20°C"][index]}
          meta={meta}
          width={width}
          tone={resolvedTheme === "dark" ? "dark" : "light"}
          art={arts[index]}
          seed={index + 7}
          open={open}
          onOpenChange={setOpen}
          action="none"
          appear={!reduce}
          appearDelay={index * 70}
          lang={lang}
          accessibleLabel={label}
          files={files
            .slice(0, 3)
            .map((f) => ({ name: f.name, meta: f.meta, photo: f.image }))}
          onFileSelect={(_, i) => onFileSelect?.(files[i], i)}
        />
      </div>
      <div className="storage-folder-foot">
        <span>{meta}</span>
        <button onClick={onOpen}>
          {l("Открыть зону", "View zone")}
          <ArrowUpRight size={15} />
        </button>
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            className="folder-files"
            initial={reduce ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
          >
            {files.slice(0, 3).map((f, i) => (
              <button key={f.id ?? i} onClick={() => onFileSelect?.(f, i)}>
                <FoodImage photo={f.image ?? "salad"} alt="" />
                <span>
                  {f.name}
                  <small>{f.meta}</small>
                </span>
                <ArrowUpRight size={15} />
              </button>
            ))}
            {!files.length && (
              <button onClick={onAdd}>
                <Plus size={17} />
                {l("Добавьте первый продукт", "Add your first product")}
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </article>
  );
}
