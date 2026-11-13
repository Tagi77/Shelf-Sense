"use client";
import { motion, useReducedMotion } from "framer-motion";
import {
  Refrigerator,
  Thermometer,
  Snowflake,
  Package,
  Plus,
  ArrowUpRight,
} from "lucide-react";
import type { Lang } from "../lib/catalog";
import FoodImage from "./food-image";
const icons = [Refrigerator, Thermometer, Snowflake, Package];
const photos = [
  ["milk-alt", "eggs"],
  ["salmon-fillet", "chicken"],
  ["strawberry", "broccoli"],
  ["bread", "tomato"],
];
export default function StorageTile({
  label,
  index,
  count,
  lang,
  onOpen,
  onAdd,
}: {
  label: string;
  index: number;
  count: number;
  lang: Lang;
  onOpen: () => void;
  onAdd: () => void;
}) {
  const reduce = useReducedMotion(),
    Icon = icons[index];
  const range = ["+2…+7°C", "0…+2°C", "−18°C", "+15…+20°C"][index];
  return (
    <motion.article
      className={`storage-tile storage-tile-${index}`}
      whileHover={reduce ? {} : { y: -3 }}
      transition={{ type: "spring", stiffness: 380, damping: 30 }}
    >
      <button
        className="storage-tile-open"
        onClick={onOpen}
        aria-label={`${lang === "ru" ? "Открыть" : "Open"} ${label}`}
      >
        <div className="storage-tile-visual">
          <span className="storage-tile-icon">
            <Icon size={22} />
          </span>
          <FoodImage photo={photos[index][0]} alt="" />
          <FoodImage photo={photos[index][1]} alt="" />
        </div>
        <div className="storage-tile-label">
          <strong>{label}</strong>
          <ArrowUpRight size={17} />
        </div>
        <span className="storage-tile-meta">
          {range}
          <b>
            {count} {lang === "ru" ? "прод." : "items"}
          </b>
        </span>
      </button>
      <button
        className="storage-tile-add"
        aria-label={`${lang === "ru" ? "Добавить продукт:" : "Add food:"} ${label}`}
        onClick={onAdd}
      >
        <Plus size={17} />
      </button>
    </motion.article>
  );
}
