"use client";
import { useState } from "react";
import { Check, Trash2 } from "lucide-react";
import Dialog from "./dialog";
import FoodImage from "./food-image";
import type { Product } from "../lib/model";
import type { Lang, Unit } from "../lib/catalog";
import {
  amountLabel,
  convertAmount,
  unitLabel,
  type Portion,
} from "../lib/inventory";
import { productName } from "../lib/recipes";
export default function PortionModal({
  product,
  kind,
  lang,
  onClose,
  onConfirm,
}: {
  product: Product;
  kind: "eaten" | "discarded";
  lang: Lang;
  onClose: () => void;
  onConfirm: (
    portions: Portion[],
    kind: "eaten" | "discarded",
    batch: string,
  ) => Promise<boolean>;
}) {
  const [unit, setUnit] = useState<Unit>(product.unit);
  const [value, setValue] = useState(String(product.amount));
  const [error, setError] = useState(false);
  const [batchId] = useState(() => crypto.randomUUID());
  const [saving, setSaving] = useState(false);
  const l = (ru: string, en: string) => (lang === "ru" ? ru : en);
  const amount = convertAmount(Number(value), unit, product.unit) ?? NaN;
  const valid =
    value !== "" &&
    Number.isFinite(amount) &&
    amount > 0 &&
    amount <= product.amount;
  const units: Unit[] =
    product.unit === "g" || product.unit === "kg"
      ? ["g", "kg"]
      : product.unit === "ml" || product.unit === "l"
        ? ["ml", "l"]
        : ["pcs"];
  return (
    <Dialog
      title={
        kind === "eaten"
          ? l("Сколько съели?", "How much did you use?")
          : l("Сколько пришлось выбросить?", "How much was discarded?")
      }
      onClose={onClose}
      closeLabel={l("Закрыть", "Close")}
      className="small-modal portion-modal"
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (saving) return;
          setSaving(true);
          if (
            valid &&
            (await onConfirm(
              [{ productId: product.id, amount, unit: product.unit }],
              kind,
              batchId,
            ))
          )
            onClose();
          else setError(true);
          setSaving(false);
        }}
      >
        <div className="simple-modal-body">
          <div className="portion-product">
            <FoodImage
              photo={product.photo}
              alt={productName(product, lang)}
              category={product.category}
            />
            <div>
              <h3>{productName(product, lang)}</h3>
              <p>
                {l("На полке: ", "On your shelf: ")}
                <b>{amountLabel(product.amount, product.unit, lang)}</b>
              </p>
            </div>
          </div>
          <label htmlFor="portion-amount">{l("Количество", "Amount")}</label>
          <div className="quantity-input">
            <input
              id="portion-amount"
              type="number"
              inputMode="decimal"
              min="0.001"
              step="any"
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setError(false);
              }}
              required
            />
            <select
              aria-label={l("Единица порции", "Portion unit")}
              value={unit}
              onChange={(e) => {
                const next = e.target.value as Unit;
                setValue(String(convertAmount(Number(value), unit, next) ?? 0));
                setUnit(next);
              }}
            >
              {units.map((u) => (
                <option key={u} value={u}>
                  {unitLabel(u, lang)}
                </option>
              ))}
            </select>
          </div>
          <div className="portion-presets">
            {[0.25, 0.5, 1].map((part) => (
              <button
                type="button"
                key={part}
                className="button secondary"
                onClick={() =>
                  setValue(
                    String(
                      convertAmount(product.amount * part, product.unit, unit),
                    ),
                  )
                }
              >
                {part === 1 ? l("Всё", "All") : part === 0.5 ? "½" : "¼"}
              </button>
            ))}
          </div>
          <div className="remaining-preview">
            <span>{l("Останется", "Remaining")}</span>
            <strong>
              {amountLabel(
                valid ? product.amount - amount : product.amount,
                product.unit,
                lang,
              )}
            </strong>
          </div>
          {kind === "discarded" && (
            <p>
              {l("Потеря: ", "Lost value: ")}
              <strong>
                {new Intl.NumberFormat(lang).format(
                  valid
                    ? (product.price * amount) /
                        (product.initialAmount ?? product.amount)
                    : 0,
                )}{" "}
                ₸
              </strong>
              {product.price === 0 && (
                <small> · {l("цена не указана", "no price entered")}</small>
              )}
            </p>
          )}
          {valid && amount === product.amount && (
            <p className="small-muted">
              {l(
                "Продукт перейдёт в историю.",
                "The product will move to history.",
              )}
            </p>
          )}
          {(error || !valid) && (
            <p className="field-error" role="alert">
              {l(
                "Укажите количество не больше остатка. Если запас изменился в другой вкладке, откройте карточку заново.",
                "Enter an amount within the remaining stock. Reopen the card if another tab changed it.",
              )}
            </p>
          )}
        </div>
        <div className="modal-footer">
          <button type="button" className="button secondary" onClick={onClose}>
            {l("Отмена", "Cancel")}
          </button>
          <button
            className={`button ${kind === "eaten" ? "primary" : "danger"}`}
            disabled={!valid || saving}
          >
            {kind === "eaten" ? <Check size={17} /> : <Trash2 size={17} />}
            {l("Сохранить", "Save")}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
