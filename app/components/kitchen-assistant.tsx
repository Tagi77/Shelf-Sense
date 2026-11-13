"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChefHat, Send, Clock3, ArrowUpRight } from "lucide-react";
import { askAI, inventoryPayload } from "../lib/ai-client";
import { kitchenSchema, type Dish } from "../lib/ai-contract";
import { localDishes } from "../lib/local-kitchen";
import type { Lang } from "../lib/catalog";
import type { Product } from "../lib/model";
import FoodImage from "./food-image";
export default function KitchenAssistant({
  products,
  lang,
  today,
  connected,
  onCook,
  initialPrompt = "",
}: {
  products: Product[];
  lang: Lang;
  today: string;
  connected: boolean;
  onCook: (dish: Dish) => void;
  initialPrompt?: string;
}) {
  const l = (ru: string, en: string) => (lang === "ru" ? ru : en);
  const [prompt, setPrompt] = useState(initialPrompt),
    [query, setQuery] = useState(""),
    [result, setResult] = useState<{ key: string; dishes: Dish[] } | null>(
      null,
    ),
    [busy, setBusy] = useState(false),
    [failed, setFailed] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const payload = JSON.stringify(inventoryPayload(products));
  const key = JSON.stringify([payload, lang, today, query]);
  const local = useMemo(
    () => localDishes(products, lang, today, query),
    [products, lang, today, query],
  );
  const shown = result?.key === key ? result.dishes : local;
  useEffect(() => {
    setPrompt(initialPrompt);
  }, [initialPrompt]);
  useEffect(() => () => controller.current?.abort(), []);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setQuery(prompt.trim());
    setFailed(false);
    if (!connected) {
      setResult(null);
      return;
    }
    const c = new AbortController();
    controller.current = c;
    setBusy(true);
    try {
      const answer = await askAI(
        "kitchen",
        { products: JSON.parse(payload), lang, today, prompt: prompt.trim() },
        kitchenSchema,
        c.signal,
      );
      setResult({
        key: JSON.stringify([payload, lang, today, prompt.trim()]),
        dishes: answer.dishes,
      });
    } catch {
      if (!c.signal.aborted) setFailed(true);
    } finally {
      if (!c.signal.aborted) setBusy(false);
    }
  }
  return (
    <section className="recipe-section">
      <div className="aside-section-heading">
        <h3>{l("Что приготовить?", "What’s cooking?")}</h3>
        <ChefHat size={21} />
      </div>
      <p className="aside-description">
        {l(
          "Сначала — продукты с ближайшим сроком.",
          "Use food with the nearest expiry first.",
        )}
      </p>
      {products.some((p) => p.state === "active") ? (
        <>
          <form className="chef-prompt" onSubmit={submit}>
            <label htmlFor="chef-request">
              {l("Ваши пожелания", "Your preferences")}
            </label>
            <textarea
              id="chef-request"
              rows={3}
              maxLength={1500}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={l(
                "Например: ужин без молока",
                "For example: dinner without milk",
              )}
            />
            <button className="button primary" disabled={busy}>
              <Send size={16} />
              {busy
                ? l("Подбираю…", "Thinking…")
                : l("Подобрать рецепт", "Find a recipe")}
            </button>
          </form>
          {(failed || !connected) && (
            <p className="recipe-source" role="status">
              {failed
                ? l(
                    "ИИ не ответил. Показываю рецепты из каталога.",
                    "AI is unavailable. Showing catalogue recipes.",
                  )
                : l("Рецепты из каталога", "Catalogue recipes")}
            </p>
          )}
          {shown.length ? (
            shown.slice(0, 3).map((dish) => (
              <button
                className="recipe-card compact-recipe"
                key={dish.id}
                onClick={() => onCook(dish)}
              >
                <div className="recipe-photo">
                  <FoodImage
                    photo={
                      products.find(
                        (p) => p.id === dish.ingredients[0]?.productId,
                      )?.photo ?? "salad"
                    }
                    alt={dish.title}
                  />
                </div>
                <div className="recipe-body">
                  <span className="recipe-source">
                    <Clock3 size={13} />
                    {dish.minutes} {l("мин", "min")}
                  </span>
                  <h4>{dish.title}</h4>
                  <span className="recipe-open">
                    {l("Ингредиенты и шаги", "Ingredients & steps")}
                    <ArrowUpRight size={15} />
                  </span>
                </div>
              </button>
            ))
          ) : (
            <p className="recipe-empty">
              {l(
                "Пока нет подходящего сочетания.",
                "No matching combination yet.",
              )}
            </p>
          )}
        </>
      ) : (
        <div className="recipe-empty">
          <ChefHat size={32} />
          <p>
            {l(
              "Добавьте продукты — предложу блюда.",
              "Add food to get meal ideas.",
            )}
          </p>
        </div>
      )}
    </section>
  );
}
