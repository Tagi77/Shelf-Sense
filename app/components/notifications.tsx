"use client";
import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  CheckCheck,
  Clock3,
  Thermometer,
  Check,
  Trash2,
  ArrowRight,
} from "lucide-react";
import Dialog from "./dialog";
import { AnimatedList } from "@/components/ui/animated-list";
import { daysUntil, temperatureAlerts, type Product } from "../lib/model";
import { productName } from "../lib/recipes";
import { amountLabel } from "../lib/inventory";
import type { Lang } from "../lib/catalog";
export default function Notifications({
  products,
  lang,
  today,
  userId,
  onProduct,
}: {
  products: Product[];
  lang: Lang;
  today: string;
  userId: string;
  onProduct: (p: Product) => void;
}) {
  const [open, setOpen] = useState(false),
    [read, setRead] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const l = (ru: string, en: string) => (lang === "ru" ? ru : en);
  useEffect(() => {
    let stopped = false;
    setRead([]);
    const refresh = async () => {
      try {
        const r = await fetch("/api/notifications", { cache: "no-store" });
        if (!r.ok) throw Error();
        const data = (await r.json()) as { read: string[] };
        if (!stopped)
          setRead((current) => [...new Set([...current, ...data.read])]);
      } catch {
        if (!stopped) setFailed(true);
      }
    };
    void refresh();
    const timer = setInterval(refresh, 5000);
    window.addEventListener("focus", refresh);
    return () => {
      stopped = true;
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [userId]);
  const notes = useMemo(
    () =>
      products
        .flatMap((p) => {
          const name = productName(p, lang),
            days = daysUntil(p.expiresOn, today);
          const notes: {
            id: string;
            product: Product;
            title: string;
            message: string;
            date: string;
            kind: string;
          }[] = [];
          if (p.state === "active" && days <= 5)
            notes.push({
              id: `expiry:${p.id}:${p.expiresOn}:${today}`,
              product: p,
              title:
                days < 0
                  ? l("Срок истёк", "Past expiry")
                  : l("Используйте в первую очередь", "Use this first"),
              message: `${name} · ${amountLabel(p.amount, p.unit, lang)}. ${days < 0 ? l("Проверьте продукт и отметьте списание.", "Review this item and record a discard.") : days === 0 ? l("Срок истекает сегодня.", "Expires today.") : l(`Осталось ${days} дн.`, `${days} days left.`)}`,
              date: p.expiresOn,
              kind: "expiry",
            });
          if (p.state === "active" && temperatureAlerts(p).length)
            notes.push({
              id: `storage:${p.id}:${p.zone}:${p.temperature}`,
              product: p,
              title: l("Проверьте хранение", "Review storage"),
              message: l(
                `${name}: выбранный режим требует внимания. Откройте параметры продукта.`,
                `${name}: review the selected storage conditions in product settings.`,
              ),
              date: today,
              kind: "storage",
            });
          for (const event of (p.portions ?? []).slice(-3))
            notes.push({
              id: event.id,
              product: p,
              title:
                event.kind === "eaten"
                  ? l("Порция учтена", "Portion recorded")
                  : l("Списание учтено", "Discard recorded"),
              message: `${name} · ${amountLabel(event.amount, p.unit, lang)}. ${l("Осталось", "Remaining")}: ${amountLabel(p.amount, p.unit, lang)}.`,
              date: event.at,
              kind: event.kind,
            });
          return notes;
        })
        .sort(
          (a, b) =>
            (a.kind === "expiry" ? 0 : 1) - (b.kind === "expiry" ? 0 : 1) ||
            (a.kind === "expiry" && b.kind === "expiry"
              ? a.date.localeCompare(b.date)
              : b.date.localeCompare(a.date)),
        ),
    [products, lang, today],
  );
  const remaining = notes.filter((n) => !read.includes(n.id));
  const unread = remaining.length;
  async function dismiss(id: string) {
    if (busy) return;
    setBusy(id);
    setFailed(false);
    try {
      const r = await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!r.ok) throw Error();
      setRead((current) => [...new Set([...current, id])]);
    } catch {
      setFailed(true);
    } finally {
      setBusy(null);
    }
  }
  return (
    <>
      <button
        className="icon-button notification-button"
        aria-label={l("Уведомления", "Notifications")}
        onClick={() => setOpen(true)}
      >
        <Bell size={19} />
        {unread > 0 && <span>{unread > 9 ? "9+" : unread}</span>}
      </button>
      {open && (
        <Dialog
          title={l("Сообщения вашей кухни", "Your kitchen updates")}
          closeLabel={l("Закрыть", "Close")}
          onClose={() => setOpen(false)}
          className="small-modal notifications-modal"
        >
          <div className="notifications-body">
            {failed && (
              <p role="alert" className="field-error">
                {l(
                  "Не удалось сохранить. Повторите действие.",
                  "Could not save. Please try again.",
                )}
              </p>
            )}
            {remaining.length ? (
              <>
                <AnimatedList lang={lang}>
                  {remaining.map((n) => {
                    const Icon =
                      n.kind === "storage"
                        ? Thermometer
                        : n.kind === "eaten"
                          ? Check
                          : n.kind === "discarded"
                            ? Trash2
                            : Clock3;
                    return (
                      <article className="notification-card" key={n.id}>
                        <span className="notification-icon">
                          <Icon size={22} />
                        </span>
                        <span>
                          <strong>{n.title}</strong>
                          <p>{n.message}</p>
                          <small>
                            {new Intl.DateTimeFormat(lang, {
                              day: "numeric",
                              month: "short",
                            }).format(new Date(n.date + "T12:00:00"))}
                            {n.product.demo ? l(" · демо", " · demo") : ""}
                          </small>
                        </span>
                        <div className="notification-actions">
                          <button
                            className="button secondary"
                            onClick={() => {
                              setOpen(false);
                              onProduct(n.product);
                            }}
                          >
                            {l("К продукту", "Open item")}
                            <ArrowRight size={16} />
                          </button>
                          <button
                            className="button primary"
                            onClick={() => void dismiss(n.id)}
                            disabled={!!busy}
                          >
                            <Check size={16} />
                            {busy === n.id
                              ? l("Убираем…", "Removing…")
                              : l("Прочитал · убрать", "Read · dismiss")}
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </AnimatedList>
              </>
            ) : (
              <div className="notifications-empty">
                <CheckCheck size={32} />
                <h3>{l("Всё под контролем", "All caught up")}</h3>
                <p>{l("Новых сообщений пока нет.", "No new updates.")}</p>
              </div>
            )}
          </div>
        </Dialog>
      )}
    </>
  );
}
