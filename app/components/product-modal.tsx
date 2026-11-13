"use client";
import { useEffect, useRef, useState } from "react";
import AnimatedSelector from "@/components/ui/animated-selector";
import { Sparkles } from "lucide-react";
import {
  foodGuide,
  guideNote,
  type FoodGuide,
  type Condition,
} from "../lib/food-guide";
import { askAI, makeFoodImage, aiError } from "../lib/ai-client";
import { aiGuideSchema } from "../lib/ai-contract";
import {
  CalendarDays,
  Check,
  CheckCircle2,
  ImageIcon,
  Leaf,
  Smile,
  TriangleAlert,
} from "lucide-react";
import Dialog from "./dialog";
import FoodImage from "./food-image";
import {
  categories,
  inferPhoto,
  profileFor,
  temperatures,
  zones,
  type Category,
  type Lang,
  type Temperature,
  type Unit,
  type Zone,
} from "../lib/catalog";
import {
  addDays,
  blankProduct,
  dayKey,
  daysUntil,
  productSchema,
  temperatureAlerts,
  type Product,
} from "../lib/model";

export default function ProductModal({
  initial,
  lang,
  onClose,
  onSave,
  connected = false,
  defaultZone,
}: {
  initial?: Product;
  lang: Lang;
  onClose: () => void;
  onSave: (product: Product) => Promise<boolean>;
  connected?: boolean;
  defaultZone?: Zone;
}) {
  const [draft, setDraft] = useState<Product>(() => {
    if (initial) return { ...initial };
    const product = blankProduct();
    return defaultZone
      ? { ...product, zone: defaultZone, temperature: zones[defaultZone].temp }
      : product;
  });
  const [photoChosen, setPhotoChosen] = useState(!!initial);
  const [categoryChosen, setCategoryChosen] = useState(!!initial);
  const [unitChosen, setUnitChosen] = useState(!!initial);
  const [errors, setErrors] = useState<string[]>([]);
  const [saveFailed, setSaveFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [aiGuide, setAiGuide] = useState<FoodGuide | null>(null);
  const [thinking, setThinking] = useState(false);
  const [aiFailed, setAiFailed] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const photoRef = useRef(draft.photo);
  photoRef.current = draft.photo;
  const autoPhotos = useRef(new Set<string>());
  const nameRef = useRef(draft.name);
  nameRef.current = draft.name;
  const hasPortions = !!initial?.portions?.length;
  const guide =
    aiGuide ?? foodGuide(draft.name, draft.condition ?? "whole", lang);
  useEffect(() => {
    setAiGuide(null);
    setAiFailed(false);
    setThinking(false);
    if (!connected || draft.name.trim().length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setThinking(true);
      askAI(
        "guide",
        { name: draft.name, condition: draft.condition ?? "whole", lang },
        aiGuideSchema,
        controller.signal,
      )
        .then((value) => {
          if (!controller.signal.aborted) setAiGuide(value);
        })
        .catch(() => {
          if (!controller.signal.aborted) setAiFailed(true);
        })
        .finally(() => {
          if (!controller.signal.aborted) setThinking(false);
        });
    }, 800);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [draft.name, draft.condition, lang, connected]);
  async function generatePhoto(name = draft.name) {
    if (!connected || name.trim().length < 2 || photoBusy) return;
    const oldPhoto = draft.photo;
    setPhotoBusy(true);
    setPhotoError("");
    try {
      const photo = await makeFoodImage(name, lang);
      if (nameRef.current === name && photoRef.current === oldPhoto) {
        setDraft((p) => ({ ...p, photo, visual: "photo" }));
        setPhotoChosen(true);
      }
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : "image_failed");
    } finally {
      setPhotoBusy(false);
    }
  }
  useEffect(() => {
    if (
      !connected ||
      photoChosen ||
      photoBusy ||
      initial ||
      !aiGuide ||
      aiGuide.confidence === "unknown" ||
      draft.name.trim().length < 3 ||
      profileFor(draft.name) ||
      autoPhotos.current.has(draft.name)
    )
      return;
    const timer = setTimeout(() => {
      autoPhotos.current.add(draft.name);
      void generatePhoto(draft.name);
    }, 700);
    return () => clearTimeout(timer);
  }, [draft.name, connected, photoChosen, photoBusy, aiGuide]);
  const l = (ru: string, en: string) => (lang === "ru" ? ru : en);
  const alerts = temperatureAlerts(draft);
  const editing = !!initial;
  function change<K extends keyof Product>(key: K, value: Product[K]) {
    setDraft((p) => ({ ...p, [key]: value }));
    setErrors((e) => e.filter((x) => x !== key));
    setSaveFailed(false);
  }
  function nameChanged(name: string) {
    const detected = profileFor(name);
    const category =
      !categoryChosen && detected ? detected.category : draft.category;
    setDraft((p) => ({
      ...p,
      name,
      nameEn: undefined,
      category,
      photo: photoChosen ? p.photo : inferPhoto(name, category),
      unit:
        !unitChosen &&
        !initial &&
        !categoryChosen &&
        detected?.category === "produce"
          ? "pcs"
          : p.unit,
    }));
    setErrors((e) => e.filter((x) => x !== "name"));
  }
  const photoOptions = [
    ...new Set([
      inferPhoto(draft.name, draft.category),
      ...categories[draft.category].photos,
    ]),
  ].slice(0, 4);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (draft.state === "active" && !(draft.amount > 0)) {
      setErrors(["amount"]);
      return;
    }
    const result = productSchema.safeParse({
      ...draft,
      initialAmount: hasPortions ? draft.initialAmount : undefined,
    });
    if (!result.success) {
      setErrors(result.error.issues.map((i) => String(i.path[0])));
      return;
    }
    if (saving) return;
    setSaving(true);
    try {
      if (await onSave(result.data)) onClose();
      else setSaveFailed(true);
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog
      title={
        editing
          ? l("Редактировать продукт", "Edit product")
          : l("Новый продукт на вашей полке", "A fresh addition to your shelf")
      }
      closeLabel={l("Закрыть", "Close")}
      onClose={onClose}
      className="product-modal"
    >
      <form onSubmit={submit} noValidate>
        <div className="modal-scroll">
          <p className="modal-subtitle">
            {l(
              "Пара деталей сейчас — меньше забытых продуктов потом.",
              "A few details now. A little less forgotten food later.",
            )}
          </p>
          <div className="form-intro">
            <div className="photo-preview">
              <FoodImage
                photo={draft.photo}
                alt={draft.name || l("Превью продукта", "Product preview")}
                category={draft.category}
                visual={draft.visual}
                eager
              />
            </div>
            <div className="photo-controls">
              <label>
                {l("Как будет выглядеть карточка", "Your product’s look")}
              </label>
              <div className="segmented">
                <button
                  type="button"
                  aria-pressed={draft.visual === "photo"}
                  onClick={() => change("visual", "photo")}
                >
                  <ImageIcon size={16} />
                  {l("Фото", "Photo")}
                </button>
                <button
                  type="button"
                  aria-pressed={draft.visual === "icon"}
                  onClick={() => change("visual", "icon")}
                >
                  <Smile size={16} />
                  {l("Иконка", "Icon")}
                </button>
              </div>
              <div
                className="photo-options"
                aria-label={l("Варианты фотографии", "Photo options")}
              >
                {photoOptions.map((photo, i) => (
                  <button
                    type="button"
                    key={photo}
                    className={draft.photo === photo ? "selected" : ""}
                    aria-label={`${l("Фото", "Photo")} ${i + 1}`}
                    aria-pressed={draft.photo === photo}
                    onClick={() => {
                      setPhotoChosen(true);
                      setDraft((p) => ({ ...p, photo, visual: "photo" }));
                    }}
                  >
                    <FoodImage photo={photo} alt="" eager />
                    {draft.photo === photo && <Check size={13} />}
                  </button>
                ))}
              </div>
              <small>
                {l(
                  draft.photo.startsWith("ai:")
                    ? "Иллюстрация, созданная ИИ"
                    : !profileFor(draft.name) && draft.name.length > 1
                      ? "Пока показано фото категории"
                      : "Фото подбирается по названию и категории",
                  draft.photo.startsWith("ai:")
                    ? "AI-generated illustration"
                    : !profileFor(draft.name) && draft.name.length > 1
                      ? "Showing a category photo for now"
                      : "Matched to the name and category",
                )}
              </small>
              <button
                type="button"
                className="button secondary generate-photo"
                disabled={
                  !connected || photoBusy || draft.name.trim().length < 2
                }
                onClick={() => generatePhoto()}
              >
                <Sparkles size={15} />
                {photoBusy
                  ? l("Создаём фото…", "Creating photo…")
                  : l("Фото с ИИ", "Generate photo")}
              </button>
              {!connected && (
                <small>
                  {l(
                    "Генерация появится после подключения ИИ",
                    "Image generation unlocks when AI is connected",
                  )}
                </small>
              )}
              {photoError && (
                <small role="status">
                  {l(
                    photoError === "provider_limit"
                      ? "Достигнут лимит генерации фото у провайдера. Пока выберите фото из каталога."
                      : "Фото не удалось создать. Можно повторить.",
                    photoError === "provider_limit"
                      ? "The provider’s image generation limit was reached. Choose a catalogue photo for now."
                      : "Could not create the photo. Try again.",
                  )}
                </small>
              )}
            </div>
          </div>
          <div className="form-grid">
            <div className="field full">
              <label htmlFor="product-name">
                {l("Название продукта", "Product name")} <span>*</span>
              </label>
              <input
                id="product-name"
                name="name"
                autoComplete="off"
                placeholder={l(
                  "Например, филе лосося",
                  "For example, salmon fillet",
                )}
                value={draft.name}
                maxLength={100}
                onChange={(e) => nameChanged(e.target.value)}
                aria-invalid={errors.includes("name")}
                required
              />
              {errors.includes("name") && (
                <p className="field-error">
                  {l("Введите название продукта.", "Enter a product name.")}
                </p>
              )}
            </div>
            <div className="field full">
              <label id="product-category-label" htmlFor="product-category">
                {l("Категория", "Category")}
              </label>
              <AnimatedSelector
                id="product-category"
                value={draft.category}
                options={Object.entries(categories).map(([value, c]) => ({
                  value,
                  label: c[lang],
                }))}
                onChange={(value) => {
                  const category = value as Category;
                  setCategoryChosen(true);
                  setPhotoChosen(false);
                  setDraft((p) => ({
                    ...p,
                    category,
                    photo: inferPhoto(p.name, category),
                    unit:
                      !unitChosen && !initial && category === "produce"
                        ? "pcs"
                        : p.unit,
                  }));
                }}
              />
            </div>
            <div className="field full">
              <label id="product-type-label">
                {l("Тип продукта", "Product type")}
              </label>
              <AnimatedSelector
                id="product-type"
                value={draft.productType ?? "perishable"}
                options={[
                  ["perishable", "Свежий", "Fresh"],
                  ["chilled", "Охлаждённый", "Chilled"],
                  ["frozen", "Замороженный", "Frozen"],
                  ["dry", "Сухой / длительного хранения", "Shelf stable"],
                ].map(([value, ru, en]) => ({ value, label: l(ru, en) }))}
                onChange={(value) => {
                  change("productType", value as Product["productType"]);
                  if (value === "frozen")
                    setDraft((p) => ({
                      ...p,
                      zone: "freezer",
                      temperature: "frozen",
                    }));
                }}
              />
            </div>
            <div className="field full">
              <label id="product-condition-label" htmlFor="product-condition">
                {l("Состояние продукта", "Product condition")}
              </label>
              <AnimatedSelector
                id="product-condition"
                value={draft.condition ?? "whole"}
                options={[
                  ["whole", "Целый / закрытый", "Whole / sealed"],
                  ["ripe", "Спелый", "Ripe"],
                  ["unripe", "Неспелый", "Unripe"],
                  ["cut", "Нарезанный", "Cut"],
                  ["opened", "Открытый", "Opened"],
                ].map(([value, ru, en]) => ({ value, label: l(ru, en) }))}
                onChange={(value) => change("condition", value as Condition)}
              />
            </div>
            {draft.name.trim().length > 1 && (
              <section className="food-guide full" aria-live="polite">
                <div className="guide-heading">
                  <Sparkles size={18} />
                  <strong>
                    {thinking
                      ? l("ИИ подбирает условия…", "AI is checking storage…")
                      : aiGuide
                        ? l("Подсказка ИИ", "AI suggestion")
                        : l("Подсказка по продукту", "Food guide")}
                  </strong>
                  <span className="mode-tag">
                    {aiGuide ? "OpenAI" : l("Справочник", "Catalogue")}
                  </span>
                </div>
                {guide && guide.confidence !== "unknown" ? (
                  <>
                    <p className="guide-duration">
                      <strong>
                        {guide.daysMin}–{guide.daysMax} {l("дн.", "days")}
                      </strong>
                      <span>
                        {temperatures[guide.temperature].label} ·{" "}
                        {zones[guide.zone][lang]}
                      </span>
                    </p>
                    <p>{guide.tip}</p>
                    <button
                      type="button"
                      className="button secondary"
                      onClick={() =>
                        setDraft((p) => ({
                          ...p,
                          category: guide.category,
                          zone: guide.zone,
                          temperature: guide.temperature,
                          expiresOn: addDays(guide.daysMin, p.addedOn),
                        }))
                      }
                    >
                      {l(
                        "Применить условия и короткий срок",
                        "Apply conditions & shorter estimate",
                      )}
                    </button>
                    <small>{guideNote(lang)}</small>
                  </>
                ) : (
                  <p>
                    {l(
                      "Для этого продукта нужен срок с упаковки или уточнение условий. После подключения ИИ появятся дополнительные варианты.",
                      "Use the package date or specify storage conditions for this food. AI will offer more options once connected.",
                    )}
                  </p>
                )}
                {aiFailed && <small>{aiError(lang)}</small>}
              </section>
            )}
            <div className="form-section-title full">
              <span>
                <Leaf size={17} />
                {l("Хранение с заботой", "Store with care")}
              </span>
              <small>
                {l(
                  "Температура зависит от места",
                  "Temperature follows location",
                )}
              </small>
            </div>
            <div className="field full">
              <label id="product-zone-label" htmlFor="product-zone">
                {l("Место хранения", "Storage location")}
              </label>
              <AnimatedSelector
                id="product-zone"
                value={draft.zone}
                options={Object.entries(zones).map(([value, z]) => ({
                  value,
                  label: z[lang],
                  detail: temperatures[z.temp].label,
                }))}
                onChange={(value) => {
                  const zone = value as Zone;
                  setDraft((p) => ({
                    ...p,
                    zone,
                    temperature: zones[zone].temp,
                  }));
                }}
              />
            </div>
            <div className="field full">
              <label
                id="product-temperature-label"
                htmlFor="product-temperature"
              >
                {l("Температурный режим", "Temperature range")}
              </label>
              <AnimatedSelector
                id="product-temperature"
                value={draft.temperature}
                options={Object.entries(temperatures).map(([value, t]) => ({
                  value,
                  label: t.label,
                  detail: t[lang],
                }))}
                onChange={(value) =>
                  change("temperature", value as Temperature)
                }
              />
              {alerts.map((alert, i) => (
                <div className="smart-alert" role="status" key={i}>
                  <TriangleAlert size={18} />
                  <p>
                    {alert.kind === "temperature"
                      ? l(
                          `При этой температуре продукт может быстро испортиться. Рекомендуемый режим: ${temperatures[alert.recommended].label}.`,
                          `This temperature may cause the food to spoil quickly. Recommended range: ${temperatures[alert.recommended].label}.`,
                        )
                      : alert.kind === "zone"
                        ? l(
                            `Режим не соответствует выбранной зоне. Для этой зоны: ${temperatures[alert.recommended].label}.`,
                            `This range does not match the storage zone. For this zone: ${temperatures[alert.recommended].label}.`,
                          )
                        : l(
                            "Молочку, мясо и готовую еду лучше хранить на основной полке: температура в дверце менее стабильна.",
                            "Keep dairy, meat and prepared meals on a main shelf: temperatures fluctuate more in the door.",
                          )}
                  </p>
                </div>
              ))}
              {!alerts.length && (
                <p className="field-success">
                  <CheckCircle2 size={14} />
                  {l(
                    "Режим подходит выбранной категории и зоне",
                    "This range matches the category and zone",
                  )}
                </p>
              )}
            </div>
            <div className="field full">
              <label htmlFor="product-added">
                {l("Дата покупки / добавления", "Purchase / added date")}
              </label>
              <input
                id="product-added"
                type="date"
                min="2000-01-01"
                max={dayKey()}
                value={draft.addedOn}
                required
                onChange={(e) => {
                  const date = e.target.value;
                  if (!date) {
                    change("addedOn", date);
                    return;
                  }
                  const duration = Math.max(
                    0,
                    daysUntil(draft.expiresOn, draft.addedOn),
                  );
                  setDraft((p) => ({
                    ...p,
                    addedOn: date,
                    expiresOn: addDays(
                      Number.isFinite(duration) ? duration : 5,
                      date,
                    ),
                  }));
                }}
              />
            </div>
            <div className="field full">
              <label htmlFor="product-expiry">
                {l("Срок годности", "Expiry date")} <span>*</span>
              </label>
              <div className="date-chips">
                {[3, 5, 7, 14].map((days) => (
                  <button
                    type="button"
                    key={days}
                    aria-pressed={
                      draft.expiresOn ===
                      addDays(days, draft.addedOn || dayKey())
                    }
                    onClick={() =>
                      change(
                        "expiresOn",
                        addDays(days, draft.addedOn || dayKey()),
                      )
                    }
                  >
                    {days} {l(days === 3 ? "дня" : "дней", "days")}
                  </button>
                ))}
              </div>
              <div className="date-input">
                <CalendarDays size={18} />
                <input
                  type="date"
                  id="product-expiry"
                  value={draft.expiresOn}
                  min="2000-01-01"
                  max="2100-12-31"
                  onChange={(e) => change("expiresOn", e.target.value)}
                  aria-invalid={errors.includes("expiresOn")}
                  required
                />
              </div>
              <small>
                {l(
                  "Дни считаются от даты покупки. Дата на упаковке важнее.",
                  "Days are counted from purchase. Follow the date on the packaging.",
                )}
              </small>
              {errors.includes("expiresOn") && (
                <p className="field-error">
                  {l("Выберите корректную дату.", "Choose a valid date.")}
                </p>
              )}
            </div>
            <div className="field">
              <label htmlFor="product-amount">
                {l("Количество / вес", "Quantity / weight")} <span>*</span>
              </label>
              <div className="quantity-input">
                <input
                  id="product-amount"
                  disabled={hasPortions}
                  inputMode="decimal"
                  type="number"
                  min="0.001"
                  max="100000"
                  step="any"
                  value={Number.isNaN(draft.amount) ? "" : draft.amount}
                  onChange={(e) =>
                    change(
                      "amount",
                      e.target.value === "" ? NaN : Number(e.target.value),
                    )
                  }
                  aria-invalid={errors.includes("amount")}
                />
                <select
                  aria-label={l("Единица измерения", "Unit")}
                  disabled={hasPortions}
                  value={draft.unit}
                  onChange={(e) => {
                    setUnitChosen(true);
                    change("unit", e.target.value as Unit);
                  }}
                >
                  {(["g", "kg", "ml", "l", "pcs"] as Unit[]).map((unit) => (
                    <option key={unit} value={unit}>
                      {lang === "ru"
                        ? { g: "г", kg: "кг", ml: "мл", l: "л", pcs: "шт." }[
                            unit
                          ]
                        : unit}
                    </option>
                  ))}
                </select>
              </div>
              {errors.includes("amount") && (
                <p className="field-error">
                  {l(
                    "Укажите количество больше нуля.",
                    "Enter a quantity greater than zero.",
                  )}
                </p>
              )}
            </div>
            <div className="field">
              <label htmlFor="product-price">
                {l("Цена всей покупки, ₸", "Total purchase cost, ₸")}{" "}
                <small>{l("необязательно", "optional")}</small>
              </label>
              <input
                id="product-price"
                disabled={hasPortions}
                type="number"
                inputMode="decimal"
                min="0"
                max="10000000"
                step="any"
                value={draft.price || ""}
                placeholder="0"
                onChange={(e) => change("price", Number(e.target.value))}
                aria-invalid={errors.includes("price")}
              />
              {errors.includes("price") && (
                <p className="field-error">
                  {l("Проверьте стоимость.", "Check the cost.")}
                </p>
              )}
            </div>
            {hasPortions && (
              <p className="small-muted full">
                {l(
                  "Количество меняется через «Съедено» и «Выбросить». Новую покупку добавьте отдельной карточкой — история и стоимость сохранятся.",
                  "Adjust quantities with Eaten and Discard. Add a new purchase separately to preserve history and cost.",
                )}
              </p>
            )}
            <div className="field full">
              <label htmlFor="product-notes">
                {l("Заметка", "Note")}{" "}
                <small>{l("необязательно", "optional")}</small>
              </label>
              <textarea
                id="product-notes"
                rows={2}
                maxLength={1000}
                placeholder={l(
                  "Например, упаковка уже открыта",
                  "For example, the package is already open",
                )}
                value={draft.notes}
                onChange={(e) => change("notes", e.target.value)}
              />
            </div>
          </div>
          {saveFailed && (
            <p role="alert" className="field-error">
              {l(
                "Не удалось сохранить в браузере. Данные остаются в форме.",
                "Couldn’t save in this browser. Your details are still in the form.",
              )}
            </p>
          )}
        </div>
        <div className="modal-footer">
          <button className="button secondary" type="button" onClick={onClose}>
            {l("Отмена", "Cancel")}
          </button>
          <button className="button primary" type="submit" disabled={saving}>
            <Check size={18} />
            {editing
              ? l("Сохранить изменения", "Save changes")
              : l("Добавить на полку", "Add to shelf")}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
