"use client";
import { motion, useReducedMotion } from "framer-motion";
import { ExpiringProductsSection } from "@/components/ui/expiring-products-section";
import GlassFolder from "@/components/ui/glass-folder-cards";
import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler";
import Notifications from "./notifications";
import TelegramPanel from "./telegram-panel";
import ScrollFloat from "@/components/ui/scroll-float";
import { LogOut, Apple, Wallet, TrendingDown } from "lucide-react";
import { useEffect, useState } from "react";
import {
  Archive,
  BarChart3,
  ArrowDownWideNarrow,
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCheck,
  Clock3,
  CircleAlert,
  Download,
  Grid2X2,
  House,
  Leaf,
  List,
  MapPin,
  Moon,
  Package,
  PanelLeftClose,
  Plus,
  Refrigerator,
  Search,
  Send,
  ShieldCheck,
  Snowflake,
  Sprout,
  Sun,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import {
  categories,
  temperatures,
  zones,
  type Lang,
  type Zone,
} from "../lib/catalog";
import { mergeDemo } from "../lib/demo";
import {
  dayKey,
  daysUntil,
  freshness,
  impact,
  remainingPercent,
  temperatureAlerts,
  type Product,
} from "../lib/model";
import { productName } from "../lib/recipes";
import { usePantry } from "../lib/use-pantry";
import Dialog from "./dialog";
import FoodImage from "./food-image";
import ProductModal from "./product-modal";
import PortionModal from "./portion-modal";
import CookingModal from "./cooking-modal";
import RobotAssistant from "./robot-assistant";
import WasteChart, { PortionHistory } from "./waste-chart";
import { useAIStatus } from "../lib/ai-client";
import {
  weeklyWaste,
  usePortions,
  undoPortions,
  amountLabel,
  InventoryConflict,
  type Portion,
} from "../lib/inventory";
import type { Dish } from "../lib/ai-contract";

type Filter = "all" | "urgent" | "soon" | "fresh" | "expired";
type ZoneFilter = "all" | "fridge" | "fresh" | "freezer" | "pantry";
export default function Dashboard({
  user,
  onLogout,
}: {
  user: { id: string; nickname: string; email: string };
  onLogout: () => void;
}) {
  const { products, ready, error, commit } = usePantry(user.id);
  const reduce = useReducedMotion();
  const [lang, setLang] = useState<Lang>("ru");
  const [zone, setZone] = useState<ZoneFilter>("all");
  const [filter, setFilter] = useState<Filter>("all");
  const [history, setHistory] = useState(false);
  const [query, setQuery] = useState("");
  const [layout, setLayout] = useState<"grid" | "list">("grid");
  const [sort, setSort] = useState("expiry");
  const [modal, setModal] = useState<Product | "new" | null>(null);
  const [addZone, setAddZone] = useState<Zone | undefined>();
  function openNewProduct(selected?: Zone) {
    setAddZone(
      selected ?? (zone === "all" || zone === "fridge" ? "shelf" : zone),
    );
    setModal("new");
  }
  const [recipe, setRecipe] = useState<Dish | null>(null);
  const [portion, setPortion] = useState<{
    product: Product;
    kind: "eaten" | "discarded";
  } | null>(null);
  const [wasteView, setWasteView] = useState(false);
  const { connected } = useAIStatus();
  const [info, setInfo] = useState<"storage" | "telegram" | null>(null);
  const [toast, setToast] = useState<{
    ru: string;
    en: string;
    undo?: string;
    batch?: string;
  } | null>(null);
  const [today, setToday] = useState(dayKey());
  const [showMobileZones, setShowMobileZones] = useState(false);
  const l = (ru: string, en: string) => (lang === "ru" ? ru : en);
  useEffect(() => {
    try {
      setLang(localStorage.getItem("shelf-lang") === "en" ? "en" : "ru");
    } catch {}
    const tick = () => setToday(dayKey());
    const timer = setInterval(tick, 60000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  useEffect(() => {
    if (ready) document.documentElement.dataset.appReady = "true";
  }, [ready]);
  function switchLang(next: Lang) {
    setLang(next);
    try {
      localStorage.setItem("shelf-lang", next);
    } catch {}
  }
  const active = products.filter((p) => p.state === "active");
  const counts = {
    all: active.length,
    urgent: active.filter((p) => freshness(p.expiresOn, today) === "urgent")
      .length,
    soon: active.filter((p) => freshness(p.expiresOn, today) === "soon").length,
    fresh: active.filter((p) => freshness(p.expiresOn, today) === "fresh")
      .length,
    expired: active.filter((p) => freshness(p.expiresOn, today) === "expired")
      .length,
  };
  const matchesZone = (p: Product, z: ZoneFilter) =>
    z === "all" ||
    (z === "fridge" &&
      (p.zone === "shelf" || p.zone === "door" || p.zone === "drawer")) ||
    p.zone === z;
  const zoneLabels = {
    all: l("Все зоны", "All zones"),
    fridge: l("Холодильник", "Fridge"),
    fresh: l("Зона свежести", "Fresh zone"),
    freezer: l("Морозилка", "Freezer"),
    pantry: l("Кладовая / Полка", "Pantry / Shelf"),
  };
  const statusLabels = {
    urgent: l("Срочно", "Use first"),
    soon: l("Скоро", "Use soon"),
    fresh: l("Свежее", "Fresh"),
    expired: l("Срок истёк", "Expired"),
  };
  const zoneIcons = {
    all: House,
    fridge: Refrigerator,
    fresh: Sprout,
    freezer: Snowflake,
    pantry: Package,
  };
  const saved = impact(products);
  const sorted = (
    history
      ? products.filter((p) => p.state !== "active" && !p.portions?.length)
      : active
  )
    .filter(
      (p) =>
        matchesZone(p, zone) &&
        (history ||
          filter === "all" ||
          freshness(p.expiresOn, today) === filter) &&
        productName(p, lang)
          .toLocaleLowerCase(lang)
          .includes(query.toLocaleLowerCase(lang)),
    )
    .sort((a, b) =>
      history
        ? (b.archivedOn ?? "").localeCompare(a.archivedOn ?? "")
        : sort === "name"
          ? productName(a, lang).localeCompare(productName(b, lang), lang)
          : sort === "added"
            ? b.addedOn.localeCompare(a.addedOn)
            : a.expiresOn.localeCompare(b.expiresOn),
    );
  const formatNumber = (n: number) =>
    new Intl.NumberFormat(lang === "ru" ? "ru-RU" : "en-GB", {
      maximumFractionDigits: 1,
    }).format(n);
  const formatDate = (date: string) =>
    new Intl.DateTimeFormat(lang === "ru" ? "ru-RU" : "en-GB", {
      day: "numeric",
      month: "short",
    }).format(new Date(`${date}T12:00:00`));
  const quantity = (p: Product) =>
    `${formatNumber(p.amount)} ${lang === "ru" ? { g: "г", kg: "кг", ml: "мл", l: "л", pcs: "шт." }[p.unit] : p.unit}`;
  function daysText(days: number) {
    return days < 0
      ? l(`Истёк ${Math.abs(days)} дн. назад`, `Expired ${Math.abs(days)}d ago`)
      : days === 0
        ? l("Сегодня", "Today")
        : days === 1
          ? l("Завтра", "Tomorrow")
          : l(`Ещё ${days} дн.`, `${days} days left`);
  }
  function applyView(view: string) {
    setZone(
      (["fridge", "fresh", "freezer", "pantry"].includes(view)
        ? view
        : "all") as ZoneFilter,
    );
    setHistory(view === "history");
    setWasteView(view === "waste");
    setFilter(view === "urgent" ? "urgent" : "all");
    setQuery("");
    setShowMobileZones(false);
  }
  function navigate(view: string) {
    applyView(view);
    if (window.location.hash !== `#${view}`)
      window.history.pushState(null, "", `#${view}`);
    window.scrollTo({ top: 0, behavior: reduce ? "instant" : "smooth" });
  }
  function changeZone(next: ZoneFilter) {
    navigate(next);
  }
  useEffect(() => {
    const restore = () => applyView(window.location.hash.slice(1) || "all");
    restore();
    window.addEventListener("hashchange", restore);
    window.addEventListener("popstate", restore);
    return () => {
      window.removeEventListener("hashchange", restore);
      window.removeEventListener("popstate", restore);
    };
  }, []);
  async function consume(
    items: Portion[],
    kind: "eaten" | "discarded",
    title = "",
    batch = crypto.randomUUID(),
  ) {
    const ok = await commit((current) => {
      if (
        title &&
        items.some((i) => {
          const p = current.find((p) => p.id === i.productId);
          return (
            !p ||
            daysUntil(p.expiresOn, today) < 0 ||
            p.temperature === "frozen" ||
            temperatureAlerts(p).some((a) => a.level === "warning")
          );
        })
      )
        throw new InventoryConflict("Review storage");
      return usePortions(current, items, kind, batch, title, today);
    });
    if (ok)
      setToast({
        ru:
          kind === "eaten"
            ? "Порция учтена. Остатки обновлены."
            : "Списание учтено в потерях за неделю.",
        en:
          kind === "eaten"
            ? "Portion logged. Stock updated."
            : "Discard logged in weekly losses.",
        batch,
      });
    return ok;
  }
  async function undoBatch(batch: string) {
    if (await commit((current) => undoPortions(current, batch)))
      setToast({
        ru: "Операция отменена. Остатки восстановлены.",
        en: "Operation undone. Stock restored.",
      });
    else
      setToast({
        ru: "После этой операции запасы изменились. Сначала отмените более позднюю запись.",
        en: "Stock has changed since this operation. Undo the later entry first.",
      });
  }
  async function restoreLegacy(id: string) {
    if (
      await commit((current) =>
        current.map((p) =>
          p.id === id ? { ...p, state: "active", archivedOn: null } : p,
        ),
      )
    )
      setToast({
        ru: "Продукт снова на полке.",
        en: "Product is back on your shelf.",
      });
  }
  async function loadDemo() {
    const before = products.length;
    if (await commit((current) => mergeDemo(current))) {
      setToast({
        ru:
          before === mergeDemo(products).length
            ? "Все демо-продукты уже загружены."
            : "Демо-холодильник загружен. Ваши продукты сохранены.",
        en:
          before === mergeDemo(products).length
            ? "All demo products are already loaded."
            : "Demo fridge loaded. Your products are preserved.",
      });
      navigate("all");
    }
  }
  async function saveProduct(p: Product) {
    const ok = await commit((current) => {
      const latest = current.find((x) => x.id === p.id);
      if (
        latest &&
        typeof modal === "object" &&
        modal !== null &&
        JSON.stringify(latest) !== JSON.stringify(modal)
      )
        throw new InventoryConflict("Stock changed");
      if (!latest && typeof modal === "object" && modal !== null)
        throw new InventoryConflict("Product removed");
      return latest
        ? current.map((x) => (x.id === p.id ? p : x))
        : [p, ...current];
    });
    if (ok) {
      setToast({ ru: "Изменения сохранены.", en: "Changes saved." });
      navigate(p.state !== "active" ? "history" : "all");
      setSort("added");
      requestAnimationFrame(() =>
        setTimeout(
          () =>
            document
              .querySelector(`[data-product-id="${p.id}"]`)
              ?.scrollIntoView({ block: "center", behavior: "instant" }),
          50,
        ),
      );
    }
    return ok;
  }
  function exportData() {
    const blob = new Blob([JSON.stringify({ version: 2, products }, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `shelf-sense-${today}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <div className="app-shell">
      <a className="skip-link" href="#inventory">
        {l("К продуктам", "Skip to products")}
      </a>
      <aside className={`sidebar ${showMobileZones ? "mobile-open" : ""}`}>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            changeZone("all");
          }}
        >
          <span className="brand-mark">
            <Apple size={23} />
          </span>
          <span>
            Shelf<span>Sense</span>
            <i>.</i>
          </span>
        </a>
        <div className="sidebar-caption">
          {l("Умное управление запасами", "Your kitchen workspace")}
        </div>
        <div className="sidebar-section-label">
          {l("ВАША КУХНЯ", "YOUR KITCHEN")}
        </div>
        <nav
          aria-label={l("Зоны хранения", "Storage zones")}
          className="zone-nav"
        >
          {(
            ["all", "fridge", "fresh", "freezer", "pantry"] as ZoneFilter[]
          ).map((key) => {
            const Icon = zoneIcons[key];
            return (
              <button
                key={key}
                className={
                  !history && !wasteView && zone === key ? "active" : ""
                }
                aria-pressed={!history && !wasteView && zone === key}
                onClick={() => changeZone(key)}
              >
                {!history && !wasteView && zone === key && (
                  <motion.i
                    layoutId="zone-active"
                    className="nav-active-fill"
                  />
                )}
                <Icon size={19} />
                <span>
                  {zoneLabels[key]}
                  {key === "fresh" && <small>0°C … +2°C</small>}
                </span>
                <b>{active.filter((p) => matchesZone(p, key)).length}</b>
              </button>
            );
          })}
        </nav>
        <div className="sidebar-divider" />
        <nav className="secondary-nav" aria-label={l("Дополнительно", "More")}>
          <button
            className={history ? "active" : ""}
            onClick={() => {
              navigate("history");
            }}
          >
            <Archive size={19} />
            {l("История продуктов", "Food history")}
          </button>
          <button
            className={wasteView ? "active" : ""}
            onClick={() => {
              navigate("waste");
            }}
          >
            <BarChart3 size={19} />
            {l("Потери по неделям", "Weekly losses")}
          </button>
          <button onClick={() => setInfo("telegram")}>
            <Send size={19} />
            {l("Telegram-бот", "Telegram bot")}
          </button>
        </nav>
        <div className="impact-card">
          <div className="impact-heading">
            <span className="impact-icon">
              <Sprout size={19} />
            </span>
            <span>{l("Сохранено", "Saved")}</span>
          </div>

          <div className="impact-number">
            {formatNumber(saved.money)} <span>₸</span>
          </div>
          <span className="impact-label">
            {l("стоимость съеденных продуктов", "value of food enjoyed")}
          </span>
          <div className="impact-weight">
            <Leaf size={17} />
            <strong>
              {formatNumber(saved.kg)} {l("кг", "kg")}
            </strong>
            <span>{l("еды спасено", "food saved")}</span>
          </div>
          <div className="impact-footnote">
            {saved.demo
              ? l("Оценка на демо-данных", "Estimate from demo data")
              : l(
                  "По вашим отметкам «Съедено» · оценочно",
                  "Based on your eaten items · estimated",
                )}
          </div>
        </div>
        <div className="sidebar-bottom">
          <button className="local-storage" onClick={() => setInfo("storage")}>
            <span className="local-dot" />
            <span>
              {l("Синхронизация с сервером", "Server sync")}
              <small>
                {l("Ваша кухня — у вас", "Your kitchen stays yours")}
              </small>
            </span>
            <ArrowUpRight size={15} />
          </button>
          <span className="sidebar-edition">SHELF SENSE / WORKSPACE</span>
        </div>
      </aside>
      <div className="workspace">
        <header className="workspace-header">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              aria-label={l("Показать зоны", "Show storage zones")}
              onClick={() => setShowMobileZones(!showMobileZones)}
            >
              <PanelLeftClose size={20} />
            </button>
            <span>{l("Мой дом", "My home")}</span>
            <span className="crumb-slash">/</span>
            <strong>
              {wasteView
                ? l("Потери", "Waste")
                : history
                  ? l("История", "History")
                  : zoneLabels[zone]}
            </strong>
          </div>
          <div className="header-controls">
            <span className="private-label">
              <ShieldCheck size={15} />
              {l("Личная кухня", "Personal kitchen")}
            </span>
            <div
              className="language-switch"
              aria-label={l("Язык", "Language")}
              role="group"
            >
              <button
                aria-pressed={lang === "ru"}
                onClick={() => switchLang("ru")}
              >
                RU
              </button>
              <button
                aria-pressed={lang === "en"}
                onClick={() => switchLang("en")}
              >
                EN
              </button>
            </div>
            <AnimatedThemeToggler lang={lang} />
            <Notifications
              products={products}
              lang={lang}
              today={today}
              userId={user.id}
              onProduct={setModal}
            />
            <RobotAssistant
              products={products}
              lang={lang}
              today={today}
              section={wasteView ? "waste" : history ? "history" : zone}
              connected={connected}
              onCook={setRecipe}
            />
            <button
              className="profile-button"
              onClick={onLogout}
              aria-label={l("Выйти", "Sign out")}
            >
              <span>{user.nickname.slice(0, 2).toUpperCase()}</span>
              <LogOut size={17} />
            </button>
          </div>
        </header>
        <div className="workspace-columns">
          <motion.main
            key={`${zone}-${history}-${wasteView}`}
            className="dashboard-main"
            data-zone={zone}
            id="inventory"
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: "easeOut" }}
          >
            <div className="page-heading">
              <div className="personal-greeting">
                {l("Привет", "Hello")}, {user.nickname}!
              </div>
              <h1>
                <ScrollFloat>
                  {wasteView
                    ? l("Аналитика потерь", "Waste analytics")
                    : history
                      ? l("История действий", "Activity history")
                      : zone !== "all"
                        ? zoneLabels[zone]
                        : l("Моя кухня", "My kitchen")}
                </ScrollFloat>
              </h1>
              <div className="heading-actions">
                <button
                  className="button primary"
                  onClick={() => openNewProduct()}
                  disabled={!ready || error === "corrupt"}
                >
                  <Plus size={18} />
                  {l("Добавить продукт", "Add a product")}
                </button>
                <button
                  className="button secondary demo-button"
                  onClick={loadDemo}
                  disabled={!ready || error === "corrupt"}
                >
                  <Refrigerator size={17} />
                  {l("Добавить демо", "Add demo food")}
                </button>
              </div>
            </div>
            {error && (
              <div className="storage-error" role="alert">
                <CircleAlert size={20} />
                <p>
                  {error === "corrupt"
                    ? l(
                        "Сохранённые данные повреждены. Они не перезаписаны. Экспортируйте данные браузера перед сбросом хранилища.",
                        "Stored data could not be read. It has not been overwritten. Back up browser storage before resetting it.",
                      )
                    : l(
                        error === "conflict"
                          ? "Запасы изменились в другом окне или Telegram. Проверьте остатки и повторите действие."
                          : "Нет связи с сервером. Изменения не подтверждены; проверьте подключение и актуальные остатки.",
                        error === "conflict"
                          ? "Stock changed in another window or Telegram. Review it and try again."
                          : "Server unavailable. Changes are not confirmed; check your connection and current stock.",
                      )}
                </p>
              </div>
            )}
            {!history && !wasteView && (
              <>
                <div className="business-metrics">
                  <button
                    className="metric-card"
                    onClick={() => navigate("all")}
                  >
                    <span className="metric-label">
                      <Package size={17} />
                      {l("Всего продуктов", "In your kitchen")}
                    </span>
                    <strong>
                      {ready ? active.length : "—"}
                      <ArrowUpRight size={18} />
                    </strong>
                    <small>
                      {l("Всё на своих местах", "Everything in one place")}
                    </small>
                  </button>
                  <button
                    className="metric-card attention"
                    onClick={() => navigate("urgent")}
                  >
                    <span className="metric-label">
                      <Clock3 size={17} />
                      {l("Сроки на исходе", "Expiring soon")}
                    </span>
                    <strong>
                      {ready ? counts.urgent : "—"}
                      <ArrowUpRight size={18} />
                    </strong>
                    <small>
                      {l(
                        "Сегодня и ближайшие 2 дня",
                        "Today and the next 2 days",
                      )}
                    </small>
                  </button>
                  <button
                    className="metric-card"
                    onClick={() => navigate("waste")}
                  >
                    <span className="metric-label">
                      <Wallet size={17} />
                      {l("Потери за неделю", "This week’s waste")}
                    </span>
                    <strong>
                      {formatNumber(
                        weeklyWaste(products, today).at(-1)?.value ?? 0,
                      )}{" "}
                      <em>₸</em>
                      <ArrowUpRight size={18} />
                    </strong>
                    <small>
                      {l(
                        "По вашим списаниям",
                        "Based on your discarded portions",
                      )}
                    </small>
                  </button>
                </div>
                {zone === "all" && (
                  <section
                    className="storage-collection"
                    aria-label={l("Зоны хранения", "Storage zones")}
                  >
                    <div className="section-kicker">
                      <span>{l("Зоны хранения", "Storage spaces")}</span>
                    </div>
                    <div className="folder-grid">
                      {(
                        ["fridge", "fresh", "freezer", "pantry"] as ZoneFilter[]
                      ).map((key, index) => {
                        const inZone = active
                          .filter((p) => matchesZone(p, key))
                          .sort((a, b) => a.expiresOn.localeCompare(b.expiresOn));
                        return (
                          <GlassFolder
                            key={key}
                            index={index}
                            lang={lang}
                            label={zoneLabels[key]}
                            meta={`${inZone.length} ${l("прод.", "items")}`}
                            files={inZone.slice(0, 3).map((p) => {
                              const days = daysUntil(p.expiresOn, today);
                              return {
                                id: p.id,
                                name: productName(p, lang),
                                image: p.photo,
                                meta:
                                  days < 0
                                    ? l("Срок истёк", "Expired")
                                    : days === 0
                                      ? l("Сегодня", "Today")
                                      : l(`${days} дн.`, `${days}d`),
                              };
                            })}
                            onOpen={() => changeZone(key)}
                            onFileSelect={(file) => {
                              const picked = inZone.find((p) => p.id === file.id);
                              if (picked) setModal(picked);
                            }}
                            onAdd={() =>
                              openNewProduct(
                                key === "fridge" ? "shelf" : (key as Zone),
                              )
                            }
                          />
                        );
                      })}
                    </div>
                  </section>
                )}
                {zone !== "all" && (
                  <section className="zone-page-intro">
                    <button
                      className="zone-back"
                      onClick={() => changeZone("all")}
                    >
                      <ArrowRight size={16} />
                      {l("Все зоны", "All storage zones")}
                    </button>
                    <span>
                      {zone === "fridge"
                        ? "+2…+7°C"
                        : zone === "fresh"
                          ? "0…+2°C"
                          : zone === "freezer"
                            ? "−18°C"
                            : "+15…+20°C"}{" "}
                      · {active.filter((p) => matchesZone(p, zone)).length}{" "}
                      {l("продуктов", "items")}
                    </span>
                  </section>
                )}
                {counts.expired > 0 && (
                  <div className="priority-banner">
                    <div className="priority-symbol">
                      <Leaf size={22} />
                    </div>
                    <div>
                      <strong>
                        {counts.expired
                          ? l(
                              "Есть продукты с истёкшим сроком",
                              "Some products are past their expiry date",
                            )
                          : counts.urgent
                            ? l(
                                "Начните с того, что не может ждать",
                                "Start with the food that can’t wait",
                              )
                            : l(
                                "На вашей кухне всё спокойно",
                                "Everything is in good order",
                              )}
                      </strong>
                      <p>
                        {counts.expired
                          ? l(
                              "Они исключены из подбора рецептов. Проверьте свою полку.",
                              "These are excluded from recipes. Take a look at your shelf.",
                            )
                          : counts.urgent
                            ? l(
                                "Ближайшие сроки — в начале списка. Помощник уже подобрал идеи.",
                                "The nearest dates come first. Your helper has a few ideas ready.",
                              )
                            : l(
                                "Добавляйте продукты и следите за сроками без лишних усилий.",
                                "Add your food and keep expiry dates in sight, effortlessly.",
                              )}
                      </p>
                    </div>
                    <button
                      className="icon-button"
                      aria-label={l(
                        "Показать приоритетные продукты",
                        "Show priority products",
                      )}
                      onClick={() => {
                        setZone("all");
                        setFilter(
                          counts.expired
                            ? "expired"
                            : counts.urgent
                              ? "urgent"
                              : "all",
                        );
                      }}
                    >
                      <ArrowRight size={19} />
                    </button>
                  </div>
                )}
              </>
            )}
            {wasteView && (
              <WasteChart products={products} lang={lang} today={today} full />
            )}
            {history && (
              <>
                <WasteChart products={products} lang={lang} today={today} />
                <PortionHistory
                  products={products}
                  lang={lang}
                  onUndo={undoBatch}
                />
              </>
            )}
            {!wasteView && (
              <section className="inventory-section">
                <div className="inventory-heading">
                  <h2>
                    {history
                      ? l("Прошлые продукты", "Past products")
                      : zone === "all"
                        ? l("Мои продукты", "Your inventory")
                        : zoneLabels[zone]}{" "}
                    <span className="count-badge">{sorted.length}</span>
                  </h2>
                  <div
                    className="view-toggle"
                    aria-label={l("Вид продуктов", "Product layout")}
                  >
                    <button
                      aria-label={l("Сетка", "Grid view")}
                      aria-pressed={layout === "grid"}
                      onClick={() => setLayout("grid")}
                    >
                      <Grid2X2 size={17} />
                    </button>
                    <button
                      aria-label={l("Список", "List view")}
                      aria-pressed={layout === "list"}
                      onClick={() => setLayout("list")}
                    >
                      <List size={18} />
                    </button>
                  </div>
                </div>
                <div className="inventory-tools">
                  <div className="search-box">
                    <Search size={18} />
                    <input
                      type="search"
                      aria-label={l("Найти продукт", "Find a product")}
                      placeholder={l(
                        "Найти на своей полке…",
                        "Search your shelf…",
                      )}
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                    {query && (
                      <button
                        className="icon-button"
                        aria-label={l("Очистить поиск", "Clear search")}
                        onClick={() => setQuery("")}
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                  <label className="sort-control">
                    <ArrowDownWideNarrow size={16} />
                    <select
                      aria-label={l("Сортировка", "Sort products")}
                      value={sort}
                      onChange={(e) => setSort(e.target.value)}
                    >
                      <option value="expiry">
                        {l("Сначала по сроку", "Expiry date")}
                      </option>
                      <option value="name">
                        {l("По названию", "Product name")}
                      </option>
                      <option value="added">
                        {l("Недавно добавленные", "Recently added")}
                      </option>
                    </select>
                  </label>
                </div>
                {!history && (
                  <div
                    className="filter-row"
                    aria-label={l("Фильтр по свежести", "Freshness filter")}
                  >
                    {(
                      [
                        "all",
                        "urgent",
                        "soon",
                        "fresh",
                        ...(counts.expired ? ["expired"] : []),
                      ] as Filter[]
                    ).map((value) => (
                      <motion.button
                        layout
                        key={value}
                        aria-pressed={filter === value}
                        onClick={() => setFilter(value)}
                      >
                        {filter === value && (
                          <motion.i
                            layoutId="freshness-active"
                            className="filter-active-fill"
                          />
                        )}
                        {value !== "all" && (
                          <span className={`status-dot ${value}`} />
                        )}
                        <span>
                          {value === "all"
                            ? l("Все продукты", "All products")
                            : statusLabels[value]}
                        </span>
                        <b>{counts[value]}</b>
                      </motion.button>
                    ))}
                  </div>
                )}
                {!ready ? (
                  <div className="empty-state">
                    <Leaf size={32} />
                    <h3>
                      {l("Открываем вашу кухню…", "Opening your kitchen…")}
                    </h3>
                  </div>
                ) : sorted.length ? (
                  <ExpiringProductsSection
                    products={sorted}
                    lang={lang}
                    today={today}
                    layout={layout}
                    onEdit={setModal}
                    onUse={(p) => setPortion({ product: p, kind: "eaten" })}
                    onDiscard={(p) =>
                      setPortion({ product: p, kind: "discarded" })
                    }
                    onRestore={restoreLegacy}
                  />
                ) : (
                  <div className="empty-state empty-kitchen">
                    <div className="empty-kitchen-art">
                      <FoodImage photo="apple" alt="" />
                      <FoodImage photo="bread" alt="" />
                    </div>
                    <h3>
                      {query || filter !== "all"
                        ? l("Ничего не найдено", "No matches")
                        : l(
                            "Здесь будут ваши продукты",
                            "A place for your food",
                          )}
                    </h3>
                    <p>
                      {query || filter !== "all"
                        ? l("Попробуйте другой фильтр.", "Try another filter.")
                        : l(
                            "Добавьте первый продукт и его срок.",
                            "Add your first item and its expiry date.",
                          )}
                    </p>
                    <button
                      className="button primary"
                      onClick={() => {
                        if (query || filter !== "all") {
                          setQuery("");
                          setFilter("all");
                        } else openNewProduct();
                      }}
                    >
                      {query || filter !== "all"
                        ? l("Сбросить фильтры", "Clear filters")
                        : l("Добавить первый продукт", "Add your first item")}
                    </button>
                  </div>
                )}
              </section>
            )}
          </motion.main>
        </div>
      </div>
      <nav
        className="bottom-nav"
        aria-label={l("Основная навигация", "Main navigation")}
      >
        <button
          className={!history && !wasteView && filter === "all" ? "active" : ""}
          onClick={() => {
            changeZone("all");
            window.scrollTo({ top: 0 });
          }}
        >
          <House size={20} />
          <span>{l("Главная", "Home")}</span>
        </button>
        <button onClick={() => openNewProduct()} disabled={!ready}>
          <Plus size={22} />
          <span>{l("Добавить", "Add")}</span>
        </button>
        <button
          className={filter === "urgent" ? "active" : ""}
          onClick={() => {
            navigate("urgent");
          }}
        >
          <Clock3 size={20} />
          <span>{l("Сроки", "Expiry")}</span>
        </button>
        <button
          className={history ? "active" : ""}
          onClick={() => {
            navigate("history");
          }}
        >
          <Archive size={20} />
          <span>{l("История", "History")}</span>
        </button>
        <button onClick={() => setInfo("telegram")}>
          <Send size={19} />
          <span>Telegram</span>
        </button>
      </nav>
      {toast && (
        <div className="toast" role="status">
          <CheckCheck size={19} />
          <span>{toast[lang]}</span>
          {(toast.undo || toast.batch) && (
            <button
              onClick={() => {
                if (toast.batch) undoBatch(toast.batch);
                else if (toast.undo) restoreLegacy(toast.undo);
              }}
            >
              {l("Отменить", "Undo")}
            </button>
          )}
          <button
            className="icon-button"
            aria-label={l("Закрыть уведомление", "Dismiss notification")}
            onClick={() => setToast(null)}
          >
            <X size={16} />
          </button>
        </div>
      )}
      {modal && (
        <ProductModal
          key={modal === "new" ? "new" : modal.id}
          initial={modal === "new" ? undefined : modal}
          defaultZone={addZone}
          connected={connected}
          lang={lang}
          onClose={() => setModal(null)}
          onSave={saveProduct}
        />
      )}
      {portion && (
        <PortionModal
          product={portion.product}
          kind={portion.kind}
          lang={lang}
          onClose={() => setPortion(null)}
          onConfirm={(items, kind, batch) => consume(items, kind, "", batch)}
        />
      )}
      {recipe && (
        <CookingModal
          dish={recipe}
          products={products}
          lang={lang}
          onClose={() => setRecipe(null)}
          onCook={(items, title, batch) =>
            consume(items, "eaten", title, batch)
          }
        />
      )}
      {info && (
        <Dialog
          title={
            info === "storage"
              ? l("Ваша кухня, ваши данные", "Your kitchen, your data")
              : info === "telegram"
                ? l("Telegram-бот", "Telegram bot")
                : l("С заботой о продуктах", "Made with a little care")
          }
          onClose={() => setInfo(null)}
          closeLabel={l("Закрыть", "Close")}
          className="small-modal"
        >
          <div className="simple-modal-body">
            {info === "storage" ? (
              <>
                <div className="info-illustration">
                  <ShieldCheck size={34} />
                </div>
                <p>
                  {l(
                    "Продукты сохраняются в вашем аккаунте на сервере. Открытый сайт синхронизируется с Telegram каждые 5 секунд. Исходная локальная копия сохранена в браузере.",
                    "Products are saved to your account on the server. The open site syncs with Telegram every 5 seconds. Your original local copy is preserved in this browser.",
                  )}
                </p>
                <p>
                  {l(
                    "Демо-продукты отмечены отдельно. Повторная загрузка демо не заменяет ваши записи.",
                    "Demo products are labelled. Loading the demo again does not replace your own entries.",
                  )}
                </p>
                <button className="button secondary" onClick={exportData}>
                  <Download size={17} />
                  {l("Скачать резервную копию", "Download a backup")}
                </button>
              </>
            ) : info === "telegram" ? (
              <TelegramPanel lang={lang} />
            ) : null}
          </div>
        </Dialog>
      )}
    </div>
  );
}
function TriangleAlertIcon() {
  return <CircleAlert size={13} />;
}
