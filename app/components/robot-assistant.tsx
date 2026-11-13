"use client";
import { useState } from "react";
import { MessageCircle, ChefHat } from "lucide-react";
import Dialog from "./dialog";
import AssistantChat from "./assistant-chat";
import KitchenAssistant from "./kitchen-assistant";
import type { Lang } from "../lib/catalog";
import type { Product } from "../lib/model";
import type { Dish } from "../lib/ai-contract";
export function KroshRobot({ speaking = false }: { speaking?: boolean }) {
  return (
    <span
      className={`krosh-robot ${speaking ? "speaking" : ""}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 92 100" fill="none">
        <ellipse
          cx="46"
          cy="94"
          rx="25"
          ry="4"
          fill="currentColor"
          opacity=".12"
        />
        <path d="M44 17c-7-8-5-13-5-13 9 0 13 5 11 12" fill="#829764" />
        <rect x="43" y="12" width="7" height="13" rx="3.5" fill="#BB4D38" />
        <path
          className="robot-arm"
          d="M24 65c-10 0-14 14-9 19 3 3 9-9 10-13M68 65c10 0 14 14 9 19-3 3-9-9-10-13"
          stroke="#DDDAD2"
          strokeWidth="9"
          strokeLinecap="round"
        />
        <rect
          x="25"
          y="59"
          width="42"
          height="32"
          rx="18"
          fill="#F4F2EC"
          stroke="#D4D0C6"
        />
        <path d="M36 61h20l-4 17H40l-4-17Z" fill="#CB654B" />
        <rect
          x="13"
          y="22"
          width="66"
          height="44"
          rx="21"
          fill="#FCFCF9"
          stroke="#D4D0C6"
          strokeWidth="2"
        />
        <rect x="21" y="29" width="50" height="30" rx="15" fill="#2B3031" />
        <g
          className="robot-eyes"
          stroke="#F5BA95"
          strokeWidth="3.5"
          strokeLinecap="round"
        >
          <path d="m31 40 5-3 5 3M51 40l5-3 5 3" />
        </g>
        <path d="M40 47c3 7 9 7 12 0" fill="#EE9678" />
        <circle cx="28" cy="48" r="2" fill="#BA634D" />
        <circle cx="64" cy="48" r="2" fill="#BA634D" />
      </svg>
    </span>
  );
}
export default function RobotAssistant({
  products,
  lang,
  today,
  section,
  connected,
  onCook,
}: {
  products: Product[];
  lang: Lang;
  today: string;
  section: string;
  connected: boolean;
  onCook: (dish: Dish) => void;
}) {
  const [open, setOpen] = useState(false),
    [tab, setTab] = useState<"chat" | "recipes">("chat"),
    [speaking, setSpeaking] = useState(false),
    [recipePrompt, setRecipePrompt] = useState("");
  const l = (ru: string, en: string) => (lang === "ru" ? ru : en);
  return (
    <>
      <button
        className="robot-launcher"
        aria-label={l("Спросить Кроша", "Ask Krosh")}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <KroshRobot />
        <span>{l("Крош", "Krosh")}</span>
      </button>
      <Dialog
        open={open}
        title={l("Крош · ваш помощник", "Krosh · your food helper")}
        onClose={() => setOpen(false)}
        closeLabel={l("Закрыть", "Close")}
        className="robot-drawer"
      >
        <div className="robot-intro">
          <KroshRobot speaking={speaking} />
          <div>
            <strong>
              {l("Привет! Что подсказать?", "Hi! How can I help?")}
            </strong>
            <span>
              {l("Продукты, хранение и рецепты.", "Food, storage and recipes.")}
            </span>
          </div>
        </div>
        <div
          className="robot-tabs"
          role="group"
          aria-label={l("Раздел помощника", "Assistant section")}
        >
          <button aria-pressed={tab === "chat"} onClick={() => setTab("chat")}>
            <MessageCircle size={17} />
            {l("Спросить", "Ask a question")}
          </button>
          <button
            aria-pressed={tab === "recipes"}
            onClick={() => setTab("recipes")}
          >
            <ChefHat size={17} />
            {l("Что приготовить", "Meal ideas")}
          </button>
        </div>
        <div className="robot-content">
          <div hidden={tab !== "chat"}>
            <AssistantChat
              products={products}
              lang={lang}
              today={today}
              section={section}
              connected={connected}
              onBusyChange={setSpeaking}
              onRecipe={(query) => {
                setRecipePrompt(query);
                setTab("recipes");
              }}
            />
          </div>
          <div hidden={tab !== "recipes"}>
            <KitchenAssistant
              products={products}
              lang={lang}
              today={today}
              connected={connected}
              initialPrompt={recipePrompt}
              onCook={(dish) => {
                setOpen(false);
                onCook(dish);
              }}
            />
          </div>
        </div>
      </Dialog>
    </>
  );
}
