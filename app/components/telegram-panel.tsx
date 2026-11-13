"use client";
import { useEffect, useState } from "react";
import {
  Send,
  Link2,
  Unplug,
  CircleCheck,
  Radio,
  ShieldCheck,
} from "lucide-react";
import type { Lang } from "../lib/catalog";
type Status = {
  configured: boolean;
  username: string | null;
  linked: boolean;
  displayName: string | null;
  online: boolean;
};
export default function TelegramPanel({ lang }: { lang: Lang }) {
  const l = (ru: string, en: string) => (lang === "ru" ? ru : en);
  const [status, setStatus] = useState<Status | null>(null),
    [url, setURL] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(false);
  useEffect(() => {
    let stopped = false;
    const refresh = async () => {
      try {
        const r = await fetch("/api/telegram/status", { cache: "no-store" });
        if (!r.ok) throw Error();
        const s = (await r.json()) as Status;
        if (!stopped) {
          setStatus(s);
          if (s.linked) setURL("");
        }
      } catch {
        if (!stopped) setError(true);
      }
    };
    void refresh();
    const t = setInterval(refresh, 5000);
    return () => {
      stopped = true;
      clearInterval(t);
    };
  }, []);
  async function connect() {
    setBusy(true);
    setError(false);
    try {
      const r = await fetch("/api/telegram/link", { method: "POST" });
      if (!r.ok) throw Error();
      setURL(((await r.json()) as { url: string }).url);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  async function unlink() {
    setBusy(true);
    setError(false);
    try {
      const r = await fetch("/api/telegram/unlink", { method: "POST" });
      if (!r.ok) throw Error();
      setStatus((s) => (s ? { ...s, linked: false, displayName: null } : s));
      setURL("");
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="telegram-connect">
      <div className="telegram-connect-icon">
        <Send size={28} />
      </div>
      <h3>
        {l("Ваша кухня — в одном сообщении", "Your kitchen, one message away")}
      </h3>
      <p>
        {l(
          "Добавляйте продукты сообщением, проверяйте сроки и готовьте из остатков. Сайт и бот используют общие запасы.",
          "Add food by message, check expiry dates and cook with leftovers. The site and bot share the same inventory.",
        )}
      </p>
      <div className="telegram-steps">
        <span>
          <b>01</b>
          {l(
            "Свяжите аккаунт по одноразовой ссылке",
            "Connect using a one-time link",
          )}
        </span>
        <span>
          <b>02</b>
          {l("Нажмите Start в Telegram", "Press Start in Telegram")}
        </span>
        <span>
          <b>03</b>
          {l("Напишите: «Молоко 3 дня»", "Send: «Молоко 3 дня» (milk, 3 days)")}
        </span>
      </div>
      {status && (
        <div className="telegram-connection-state" role="status">
          {status.linked ? <CircleCheck size={18} /> : <Link2 size={18} />}
          <span>
            {status.linked
              ? l(
                  `Подключён ${status.displayName}`,
                  `Connected: ${status.displayName}`,
                )
              : l("Аккаунт ещё не связан", "Account not connected yet")}
          </span>
        </div>
      )}
      {status && (
        <p className="small-muted">
          <Radio size={14} />{" "}
          {status.online
            ? l(
                "Бот на связи · синхронизация каждые 5 секунд",
                "Bot online · syncing every 5 seconds",
              )
            : l(
                "Процесс бота сейчас не на связи. Сообщения будут обработаны после запуска.",
                "The bot process is offline. Messages will be processed once it starts.",
              )}
        </p>
      )}
      {error && (
        <p className="field-error" role="alert">
          {l(
            "Не удалось проверить соединение. Повторите действие или обновите страницу.",
            "Could not check the connection. Retry or reload the page.",
          )}
        </p>
      )}
      {!status ? (
        <p>{l("Проверяем подключение…", "Checking connection…")}</p>
      ) : !status.configured ? (
        <p>
          {l(
            "Бот пока не настроен на сервере.",
            "The bot is not configured on the server yet.",
          )}
        </p>
      ) : status.linked ? (
        <>
          <a
            className="button primary"
            href={`https://t.me/${status.username}`}
            target="_blank"
            rel="noreferrer"
          >
            <Send size={17} />
            {l("Открыть бота", "Open bot")}
          </a>
          <button className="button secondary" disabled={busy} onClick={unlink}>
            <Unplug size={16} />
            {l("Отключить Telegram", "Disconnect Telegram")}
          </button>
        </>
      ) : url ? (
        <>
          <a
            className="button primary"
            href={url}
            target="_blank"
            rel="noreferrer"
          >
            <Send size={17} />
            {l("Перейти в бот и нажать Start", "Open bot and press Start")}
          </a>
          <p className="small-muted">
            {l(
              "Ссылка действует 10 минут. Не пересылайте её другим людям.",
              "The link expires in 10 minutes. Do not share it with others.",
            )}
          </p>
          <button
            className="button secondary"
            disabled={busy}
            onClick={connect}
          >
            {l("Создать новую ссылку", "Create a new link")}
          </button>
        </>
      ) : (
        <button className="button primary" onClick={connect} disabled={busy}>
          <Link2 size={17} />
          {busy
            ? l("Готовим ссылку…", "Preparing link…")
            : l("Связать аккаунт", "Connect account")}
        </button>
      )}
      <p className="small-muted">
        <ShieldCheck size={14} />
        {l(
          "Бот отвечает на русском. Списание происходит только по вашей команде. «Тест уведомления» — ручная демонстрация, без ежедневной рассылки.",
          "The bot speaks Russian. Food is deducted only on your command. Test notification is a manual demo, not a daily schedule.",
        )}
      </p>
    </section>
  );
}
