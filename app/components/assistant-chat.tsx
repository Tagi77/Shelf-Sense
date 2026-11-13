"use client";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Send, Sparkles, Package, Grid2X2, ArrowUpRight } from "lucide-react";
import { askAI, inventoryPayload } from "../lib/ai-client";
import { chatSchema } from "../lib/ai-contract";
import { localAdvice } from "../lib/local-kitchen";
import type { Product } from "../lib/model";
import type { Lang } from "../lib/catalog";
type Message = { role: "user" | "assistant"; content: string };
export default function AssistantChat({
  products,
  lang,
  today,
  section,
  connected,
  onRecipe,
  onBusyChange,
}: {
  products: Product[];
  lang: Lang;
  today: string;
  section: string;
  connected: boolean;
  onRecipe: (query: string) => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]),
    [text, setText] = useState(""),
    [busy, setBusy] = useState(false),
    [failed, setFailed] = useState(false),
    [includeStock, setIncludeStock] = useState(true),
    [showPrompts, setShowPrompts] = useState(false);
  const scroll = useRef<HTMLDivElement>(null),
    sending = useRef(false);
  const l = (ru: string, en: string) => (lang === "ru" ? ru : en);
  useEffect(() => {
    onBusyChange?.(busy);
  }, [busy, onBusyChange]);
  useEffect(() => {
    scroll.current?.scrollTo({ top: scroll.current.scrollHeight });
  }, [messages, busy]);
  async function send(value = text, retry = false) {
    const input = value.trim();
    if (!input || sending.current) return;
    sending.current = true;
    const next: Message[] = retry
      ? messages
      : [...messages, { role: "user", content: input }];
    setMessages(next);
    setText("");
    setBusy(true);
    setFailed(false);
    try {
      const selected = includeStock ? products : [];
      const content = connected
        ? (
            await askAI(
              "chat",
              {
                products: inventoryPayload(selected),
                lang,
                today,
                section,
                prompt: input,
                messages: next.slice(-12),
              },
              chatSchema,
            )
          ).message
        : l(
            "ИИ сейчас недоступен. Из справочника: ",
            "AI is offline. From the catalogue: ",
          ) + localAdvice(selected, lang, section, today).tips[0];
      setMessages((m) =>
        [...m, { role: "assistant" as const, content }].slice(-12),
      );
    } catch {
      setFailed(true);
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="assistant-chat">
      <div className="chat-messages" ref={scroll} role="log" aria-live="polite">
        {messages.map((m, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className={`chat-bubble ${m.role}`}
          >
            {m.content}
          </motion.div>
        ))}
        {busy && (
          <div
            className="typing-dots"
            role="status"
            aria-label={l("Крош думает", "Krosh is thinking")}
          >
            <i />
            <i />
            <i />
          </div>
        )}
      </div>
      {failed && (
        <div className="field-error" role="alert">
          <p>
            {l(
              "ИИ сейчас не ответил. Запрос сохранён — попробуйте повторить.",
              "AI did not respond. Your question is kept — please retry.",
            )}
          </p>
          <button
            className="chat-retry"
            onClick={() => {
              const last = [...messages]
                .reverse()
                .find((m) => m.role === "user");
              if (last) void send(last.content, true);
            }}
            disabled={busy}
          >
            {l("Повторить", "Retry")}
          </button>
        </div>
      )}
      <form
        className="composer-shell"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <div className="composer-core">
          <label htmlFor="assistant-question" className="sr-only">
            {l("Вопрос помощнику", "Question for the assistant")}
          </label>
          <textarea
            id="assistant-question"
            placeholder={l("Напишите Крошу…", "Ask Krosh…")}
            rows={3}
            maxLength={1500}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (
                e.key === "Enter" &&
                !e.shiftKey &&
                !e.nativeEvent.isComposing
              ) {
                e.preventDefault();
                void send();
              }
            }}
          />
          <div className="composer-options">
            <div className="composer-tools">
              <button
                type="button"
                aria-pressed={includeStock}
                aria-label={l("Учитывать мои продукты", "Include my inventory")}
                title={l("Учитывать мои продукты", "Include my inventory")}
                onClick={() => setIncludeStock(!includeStock)}
              >
                <Package size={19} />
              </button>
              <button
                type="button"
                aria-expanded={showPrompts}
                aria-label={l("Идеи вопросов", "Prompt ideas")}
                title={l("Идеи вопросов", "Prompt ideas")}
                onClick={() => setShowPrompts(!showPrompts)}
              >
                <Grid2X2 size={19} />
              </button>
            </div>
            <button
              className="chat-send"
              disabled={!text.trim() || busy}
              aria-label={l("Отправить вопрос", "Send question")}
            >
              <Send size={18} />
            </button>
          </div>
        </div>
        <div className="composer-context">
          <i />
          {includeStock
            ? l(
                `Учитываю продукты: ${products.filter((p) => p.state === "active").length}`,
                `Using your inventory: ${products.filter((p) => p.state === "active").length} items`,
              )
            : l("Без содержимого холодильника", "Without inventory context")}
        </div>
        {showPrompts && (
          <div className="composer-prompts">
            {[
              l(
                "Что использовать в первую очередь?",
                "What should I use first?",
              ),
              l("Как лучше хранить фрукты?", "How should I store fruit?"),
              l("Предложи быстрый завтрак", "Suggest a quick breakfast"),
            ].map((prompt) => (
              <button
                type="button"
                key={prompt}
                onClick={() => {
                  setText(prompt);
                  setShowPrompts(false);
                  document.getElementById("assistant-question")?.focus();
                }}
              >
                {prompt}
              </button>
            ))}
          </div>
        )}
      </form>
      <div className="chat-quick">
        <button
          onClick={() =>
            onRecipe(
              l(
                "Что приготовить из продуктов с ближайшим сроком?",
                "What can I make with food expiring first?",
              ),
            )
          }
        >
          {l("Идея для ужина", "Dinner ideas")} <ArrowUpRight size={12} />
        </button>
        <button
          onClick={() =>
            void send(
              l(
                "Как лучше хранить мои продукты?",
                "How should I store my food?",
              ),
            )
          }
          disabled={busy}
        >
          {l("Совет по хранению", "Storage advice")}
        </button>
      </div>
    </section>
  );
}
