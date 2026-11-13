"use client";
import { useState } from "react";
import { ChefHat, Check, Clock3 } from "lucide-react";
import Dialog from "./dialog";
import type { Dish } from "../lib/ai-contract";
import type { Lang } from "../lib/catalog";
import type { Product } from "../lib/model";
import { amountLabel, unitLabel, type Portion } from "../lib/inventory";
export default function CookingModal({
  dish,
  products,
  lang,
  onClose,
  onCook,
}: {
  dish: Dish;
  products: Product[];
  lang: Lang;
  onClose: () => void;
  onCook: (
    portions: Portion[],
    title: string,
    batch: string,
  ) => Promise<boolean>;
}) {
  const [amounts, setAmounts] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      dish.ingredients.map((i) => [i.productId, String(i.amount)]),
    ),
  );
  const [error, setError] = useState(false);
  const [batchId] = useState(() => crypto.randomUUID());
  const [saving, setSaving] = useState(false);
  const l = (ru: string, en: string) => (lang === "ru" ? ru : en);
  const valid =
    dish.ingredients.every((i) => {
      const p = products.find((p) => p.id === i.productId);
      const n = Number(amounts[i.productId]);
      return (
        p &&
        p.state === "active" &&
        p.unit === i.unit &&
        amounts[i.productId] !== "" &&
        Number.isFinite(n) &&
        n >= 0 &&
        n <= p.amount
      );
    }) && dish.ingredients.some((i) => Number(amounts[i.productId]) > 0);
  return (
    <Dialog
      title={dish.title}
      onClose={onClose}
      closeLabel={l("Закрыть", "Close")}
      className="recipe-modal cooking-modal"
    >
      <div className="recipe-modal-scroll">
        <div className="cooking-intro">
          <ChefHat size={30} />
          <span>
            <Clock3 size={15} /> {dish.minutes}{" "}
            {l("мин · 1–2 порции", "min · 1–2 servings")}
          </span>
        </div>
        <p>{dish.reason}</p>
        <h3>{l("Что пойдёт в блюдо", "Ingredients from your shelf")}</h3>
        <p className="small-muted">
          {l(
            "Уточните фактическое количество. Запасы обновятся только после «Готово».",
            "Adjust to what you actually use. Stock changes only after you press “Done”.",
          )}
        </p>
        <div className="cooking-ingredients">
          {dish.ingredients.map((i) => {
            const p = products.find((p) => p.id === i.productId);
            const n = Number(amounts[i.productId]);
            return (
              <label key={i.productId}>
                <span>
                  <strong>{i.name}</strong>
                  <small>
                    {l("На полке: ", "In stock: ")}
                    {amountLabel(p?.amount ?? 0, i.unit, lang)}
                  </small>
                </span>
                <span className="cooking-quantity">
                  <input
                    aria-label={`${l("Использовать", "Use")} ${i.name}`}
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="any"
                    value={amounts[i.productId]}
                    onChange={(e) => {
                      setError(false);
                      setAmounts((a) => ({
                        ...a,
                        [i.productId]: e.target.value,
                      }));
                    }}
                  />
                  <b>{unitLabel(i.unit, lang)}</b>
                  <small>
                    {l("Остаток: ", "Left: ")}
                    {amountLabel(
                      Math.max(
                        0,
                        (p?.amount ?? 0) - (Number.isFinite(n) ? n : 0),
                      ),
                      i.unit,
                      lang,
                    )}
                  </small>
                </span>
              </label>
            );
          })}
        </div>
        {!!dish.extras.length && (
          <div className="missing-ingredients">
            <strong>{l("Добавить отдельно", "You will also need")}</strong>
            <p>{dish.extras.join(" · ")}</p>
            <small>
              {l(
                "Этого нет в запасах — не списывается.",
                "Not in your inventory — will not be deducted.",
              )}
            </small>
          </div>
        )}
        <h3>{l("Как приготовить", "How to cook")}</h3>
        <ol>
          {dish.steps.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>
        {dish.improvement && (
          <div className="dish-improvement">
            <strong>
              {l("Можно сделать ещё вкуснее", "Make it even better")}
            </strong>
            <p>{dish.improvement}</p>
          </div>
        )}
        {error && (
          <p className="field-error" role="alert">
            {l(
              "Запасы или условия хранения изменились. Проверьте количество и свежесть продуктов.",
              "Stock or storage conditions changed. Review quantities and freshness.",
            )}
          </p>
        )}
      </div>
      <div className="modal-footer">
        <button className="button secondary" onClick={onClose}>
          {l("Позже", "Later")}
        </button>
        <button
          className="button primary"
          disabled={!valid || saving}
          onClick={async () => {
            if (saving) return;
            setSaving(true);
            const items = dish.ingredients
              .map((i) => ({
                productId: i.productId,
                amount: Number(amounts[i.productId]),
                unit: i.unit,
              }))
              .filter((i) => i.amount > 0);
            if (await onCook(items, dish.title, batchId)) onClose();
            else setError(true);
            setSaving(false);
          }}
        >
          <Check size={17} />
          {l("Готово · списать продукты", "Done · update stock")}
        </button>
      </div>
    </Dialog>
  );
}
