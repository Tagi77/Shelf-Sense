"use client";
import { motion, useReducedMotion } from "framer-motion";
import {
  Check,
  Pencil,
  Trash2,
  Undo2,
  ChevronDown,
  MapPin,
  Snowflake,
} from "lucide-react";
import FoodImage from "@/app/components/food-image";
import { categories, zones, temperatures, type Lang } from "@/app/lib/catalog";
import {
  daysUntil,
  freshness,
  remainingPercent,
  temperatureAlerts,
  type Product,
} from "@/app/lib/model";
import { productName } from "@/app/lib/recipes";
import { amountLabel } from "@/app/lib/inventory";
export function ExpiringProductCard({
  product: p,
  lang,
  today,
  index = 0,
  onEdit,
  onUse,
  onDiscard,
  onRestore,
}: {
  product: Product;
  lang: Lang;
  today: string;
  index?: number;
  onEdit: () => void;
  onUse: () => void;
  onDiscard: () => void;
  onRestore: () => void;
}) {
  const reduce = useReducedMotion();
  const l = (ru: string, en: string) => (lang === "ru" ? ru : en);
  const state = freshness(p.expiresOn, today);
  const days = daysUntil(p.expiresOn, today);
  const status = {
    urgent: l("Срочно", "Use first"),
    soon: l("Скоро", "Use soon"),
    fresh: l("Свежее", "Fresh"),
    expired: l("Срок истёк", "Expired"),
  };
  const date = new Intl.DateTimeFormat(lang === "ru" ? "ru-RU" : "en-GB", {
    day: "numeric",
    month: "short",
  }).format(new Date(p.expiresOn + "T12:00:00"));
  return (
    <motion.article
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        type: "spring",
        stiffness: 380,
        damping: 30,
        delay: Math.min(index, 5) * 0.035,
      }}
      whileHover={reduce ? undefined : { y: -3 }}
      className={`product-card ${state}`}
      data-product-id={p.id}
      aria-label={productName(p, lang)}
    >
      <div className="product-visual">
        <FoodImage
          photo={p.photo}
          alt={productName(p, lang)}
          visual={p.visual}
          category={p.category}
          eager={index < 6}
        />
        <span className={`freshness-badge ${state}`}>
          <span />
          {p.state === "active"
            ? status[state]
            : p.state === "eaten"
              ? l("Съедено", "Enjoyed")
              : l("Выброшено", "Discarded")}
        </span>
        <button
          className="edit-product"
          aria-label={`${l("Изменить", "Edit")} ${productName(p, lang)}`}
          onClick={onEdit}
        >
          <Pencil size={16} />
        </button>
      </div>
      <div className="product-info">
        <div className="product-category">
          {categories[p.category][lang]}
          {p.demo && <span className="demo-tag">{l("демо", "demo")}</span>}
        </div>
        <h3>{productName(p, lang)}</h3>
        <p className="product-quantity">
          <strong>
            {l("Осталось: ", "Left: ")}
            {amountLabel(p.amount, p.unit, lang)}
          </strong>
        </p>
        {!!p.portions?.length && (
          <p className="used-quantity">
            {l("Использовано: ", "Used: ")}
            {amountLabel(
              p.portions
                .filter((e) => e.kind === "eaten")
                .reduce((n, e) => n + e.amount, 0),
              p.unit,
              lang,
            )}{" "}
            · {l("списано: ", "discarded: ")}
            {amountLabel(
              p.portions
                .filter((e) => e.kind === "discarded")
                .reduce((n, e) => n + e.amount, 0),
              p.unit,
              lang,
            )}
          </p>
        )}
        <div className="expiry-row">
          <span>
            {days < 0
              ? l("Срок истёк", "Expired")
              : days === 0
                ? l("Сегодня", "Today")
                : days === 1
                  ? l("Завтра", "Tomorrow")
                  : l(`Ещё ${days} дн.`, `${days} days left`)}
          </span>
          <time dateTime={p.expiresOn}>
            {l("до", "by")} {date}
          </time>
        </div>
        <div
          className={`expiry-track ${state}`}
          role="progressbar"
          aria-label={l("Оставшаяся часть срока", "Remaining shelf life")}
          aria-valuenow={Math.round(remainingPercent(p, today))}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <span style={{ width: `${remainingPercent(p, today)}%` }} />
        </div>
        <details className="product-details">
          <summary>
            {l("Условия хранения", "Storage details")}
            <ChevronDown size={15} />
          </summary>
          <div className="storage-tags">
            <span>
              <MapPin size={12} />
              {zones[p.zone][lang]}
            </span>
            <span>
              <Snowflake size={12} />
              {temperatures[p.temperature].label}
            </span>
          </div>
          {p.notes && <p>{p.notes}</p>}
        </details>
        {temperatureAlerts(p).some((a) => a.level === "warning") && (
          <button className="card-warning" onClick={onEdit}>
            {l("Проверьте условия хранения", "Check storage conditions")}
          </button>
        )}
        <div className="product-actions">
          {p.state === "active" ? (
            <>
              <button className="eaten-button" onClick={onUse}>
                <Check size={16} />
                {l("Съедено", "Eaten")}
              </button>
              <button className="discard-button" onClick={onDiscard}>
                <Trash2 size={15} />
                {l("Выбросить", "Discard")}
              </button>
            </>
          ) : (
            <button className="eaten-button" onClick={onRestore}>
              <Undo2 size={16} />
              {l("Вернуть на полку", "Back to shelf")}
            </button>
          )}
        </div>
      </div>
    </motion.article>
  );
}
