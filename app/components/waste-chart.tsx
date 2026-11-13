"use client";
import { useState } from "react";
import { BarChart3, TrendingDown } from "lucide-react";
import type { Product } from "../lib/model";
import type { Lang } from "../lib/catalog";
import { amountLabel, ledger, weeklyWaste } from "../lib/inventory";
import { productName } from "../lib/recipes";
export default function WasteChart({
  products,
  lang,
  today,
  full = false,
}: {
  products: Product[];
  lang: Lang;
  today: string;
  full?: boolean;
}) {
  const [demo, setDemo] = useState(false);
  const [selected, setSelected] = useState(7);
  const l = (ru: string, en: string) => (lang === "ru" ? ru : en);
  const real = weeklyWaste(products, today);
  const example = [320, 720, 450, 900, 610, 280, 420, 180];
  const weeks = demo
    ? real.map((w, i) => ({ ...w, value: example[i], kg: example[i] / 1400 }))
    : real;
  const max = Math.max(...weeks.map((w) => w.value), 1);
  const week = weeks[selected];
  const money = (v: number) =>
    new Intl.NumberFormat(lang, { maximumFractionDigits: 0 }).format(v);
  const date = (s: string) =>
    new Intl.DateTimeFormat(lang, { day: "numeric", month: "short" }).format(
      new Date(s + "T12:00:00"),
    );
  return (
    <section
      className={`waste-panel ${full ? "full" : ""}`}
      aria-label={l("Потери по неделям", "Weekly food waste")}
    >
      <div className="waste-heading">
        <div>
          <span className="eyebrow">
            <BarChart3 size={15} />
            {l("БЕРЕЖЁМ ЕДУ И БЮДЖЕТ", "SAVE FOOD & MONEY")}
          </span>
          <h2>{l("Сколько стоили потери", "The cost of food waste")}</h2>
        </div>
        <button
          className="button secondary"
          aria-pressed={demo}
          onClick={() => setDemo(!demo)}
        >
          {demo
            ? l("Мои данные", "My data")
            : l("Пример графика", "Example chart")}
        </button>
      </div>
      <div className="waste-summary">
        <strong>
          {money(week.value)} <small>₸</small>
        </strong>
        <span>
          {date(week.from)} — {date(week.to)}
          <small>
            {demo
              ? l("Демонстрационный пример", "Illustrative demo")
              : l(
                  "Стоимость выброшенных порций",
                  "Value of discarded portions",
                )}
          </small>
        </span>
      </div>
      <div
        className="waste-bars"
        role="group"
        aria-label={l("Последние 8 недель", "Last 8 weeks")}
      >
        {weeks.map((w, i) => (
          <button
            key={w.from}
            className={selected === i ? "selected" : ""}
            onClick={() => setSelected(i)}
            aria-pressed={selected === i}
            aria-label={`${date(w.from)} — ${date(w.to)}: ${money(w.value)} ₸`}
          >
            <span className="bar-value">{money(w.value)}</span>
            <span className="bar-track">
              <i
                style={{
                  height: w.value
                    ? `${Math.max(4, (w.value / max) * 100)}%`
                    : "2px",
                }}
              />
            </span>
            <span>{date(w.from)}</span>
          </button>
        ))}
      </div>
      {!demo && !weeks.some((w) => w.value > 0) && (
        <p className="waste-empty">
          <TrendingDown size={17} />
          {l(
            "Пока нет потерь с указанной стоимостью. Списанные порции появятся здесь автоматически.",
            "No priced losses yet. Discarded portions appear here automatically.",
          )}
        </p>
      )}
      {!demo && week.unpriced > 0 && (
        <p className="small-muted">
          {l(
            `${week.unpriced} списаний без цены не включены в сумму.`,
            `${week.unpriced} unpriced entries are not included in the amount.`,
          )}
        </p>
      )}
      {full && !demo && (
        <div className="waste-breakdown">
          {week.entries.map((e) => (
            <div key={e.id}>
              <span>
                {productName(e.product, lang)}
                <small>{amountLabel(e.amount, e.product.unit, lang)}</small>
              </span>
              <strong>{money(e.value)} ₸</strong>
            </div>
          ))}
        </div>
      )}
      <p className="small-muted">
        {l(
          "Неделя: понедельник — воскресенье. Стоимость покупки распределяется по использованному и выброшенному количеству. Демо-продукты не входят в ваши потери.",
          "Weeks run Monday–Sunday. Purchase cost is allocated to used and discarded quantities. Demo products are excluded from your losses.",
        )}
      </p>
    </section>
  );
}
export function PortionHistory({
  products,
  lang,
  onUndo,
}: {
  products: Product[];
  lang: Lang;
  onUndo: (batchId: string) => void;
}) {
  const entries = ledger(products);
  const l = (ru: string, en: string) => (lang === "ru" ? ru : en);
  return (
    <section className="portion-history">
      <h2>{l("Порции и приготовления", "Portions & cooking")}</h2>
      {entries.length ? (
        entries.slice(0, 80).map((e) => (
          <div className="history-entry" key={e.id}>
            <span className={`history-kind ${e.kind}`}>
              {e.kind === "eaten"
                ? l("Использовано", "Used")
                : l("Выброшено", "Discarded")}
            </span>
            <div>
              <strong>{productName(e.product, lang)}</strong>
              <small>
                {e.at} · {e.note || l("Ручная отметка", "Manual entry")}
                {e.product.demo ? " · demo" : ""}
              </small>
            </div>
            <b>
              {amountLabel(e.amount, e.product.unit, lang)}
              <small>{Math.round(e.value)} ₸</small>
            </b>
            {!e.id.startsWith("legacy:") &&
              e.product.portions?.at(-1)?.batchId === e.batchId && (
                <button
                  className="button secondary"
                  onClick={() => onUndo(e.batchId)}
                >
                  {l("Отменить", "Undo")}
                </button>
              )}
          </div>
        ))
      ) : (
        <p className="small-muted">
          {l(
            "Отметьте первую съеденную порцию — она появится здесь.",
            "Log your first portion to see it here.",
          )}
        </p>
      )}
    </section>
  );
}
