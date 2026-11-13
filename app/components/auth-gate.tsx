"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Apple,
  ShieldCheck,
  Eye,
  EyeOff,
  Clock3,
  ChefHat,
  Package,
  Check,
} from "lucide-react";
import { MagicCard } from "@/components/ui/magic-card";
import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler";
import { BackgroundCubesGridDemo } from "@/components/background-cubes-grid-demo";
import Dashboard from "./dashboard";
import type { Lang } from "../lib/catalog";
type User = { id: string; nickname: string; email: string };
export default function AuthGate() {
  const [user, setUser] = useState<User | null>(null),
    [loading, setLoading] = useState(true),
    [mode, setMode] = useState<"login" | "register">("register"),
    [lang, setLang] = useState<Lang>("ru");
  const [nickname, setNickname] = useState(""),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [visible, setVisible] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const l = (ru: string, en: string) => (lang === "ru" ? ru : en);
  useEffect(() => {
    try {
      setLang(localStorage.getItem("shelf-lang") === "en" ? "en" : "ru");
    } catch {}
    fetch("/api/auth/session")
      .then((r) => {
        if (!r.ok) throw Error();
        return r.json() as Promise<{ user: User | null }>;
      })
      .then((d) => {
        setUser(d.user);
        if (d.user) setMode("login");
      })
      .catch(() => setError("unavailable"))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  const messages: Record<string, string> = {
    account_exists: l(
      "Этот email уже зарегистрирован. Выберите «Войти».",
      "This email is registered. Choose Sign in.",
    ),
    invalid_credentials: l(
      "Проверьте email и пароль.",
      "Check your email and password.",
    ),
    invalid_input: l(
      "Никнейм: 2–32 символа. Пароль: 8–128 символов. Проверьте email.",
      "Nickname: 2–32 characters. Password: 8–128 characters. Check your email.",
    ),
    too_many_attempts: l(
      "Слишком много попыток. Повторите через 15 минут.",
      "Too many attempts. Try again in 15 minutes.",
    ),
    unavailable: l(
      "Не удалось связаться с сервером. Попробуйте ещё раз.",
      "Could not reach the server. Please try again.",
    ),
  };
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname, email, password }),
      });
      const d = (await r.json()) as { user: User; error: string };
      if (!r.ok) {
        setError(d.error);
        return;
      }
      setPassword("");
      setUser(d.user);
      setMode("login");
    } catch {
      setError("unavailable");
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    try {
      const r = await fetch("/api/auth/logout", { method: "POST" });
      if (!r.ok) throw Error();
      setNickname(user?.nickname ?? "");
      setEmail(user?.email ?? "");
      setUser(null);
      setPassword("");
      try {
        setLang(localStorage.getItem("shelf-lang") === "en" ? "en" : "ru");
      } catch {}
    } catch {
      setError("unavailable");
    }
  }
  if (user)
    return (
      <>
        <Dashboard key={user.id} user={user} onLogout={logout} />
        {error && (
          <div className="toast" role="alert">
            {messages[error] ?? messages.unavailable}
            <button onClick={() => setError("")}>OK</button>
          </div>
        )}
      </>
    );
  return (
    <main className="auth-page">
      <header className="auth-header">
        <a className="brand" href="/">
          <span className="brand-mark">
            <Apple size={23} />
          </span>
          Shelf<span>Sense.</span>
        </a>
        <div className="auth-controls">
          <div className="language-switch" aria-label="Language">
            {(["ru", "en"] as const).map((v) => (
              <button
                key={v}
                aria-pressed={lang === v}
                onClick={() => {
                  setLang(v);
                  try {
                    localStorage.setItem("shelf-lang", v);
                  } catch {}
                }}
              >
                {v.toUpperCase()}
              </button>
            ))}
          </div>
          <AnimatedThemeToggler lang={lang} />
        </div>
      </header>
      <div className="auth-layout">
        <section className="auth-story">
          <BackgroundCubesGridDemo />
          <span className="editorial-label">
            <i />
            {l("ДОМА ВКУСНЕЕ.", "FRESH FOOD. LESS WASTE.")}
          </span>
          <h1>
            {l("Меньше отходов.", "Less waste.")}
            <br />
            <span>{l("Больше вкуса.", "More taste.")}</span>
          </h1>
          <p>
            {l(
              "Всё, что есть дома. Всё, что пора приготовить.",
              "See what you have. Know what to cook next.",
            )}
          </p>
          <motion.div
            className="auth-preview"
            initial={{ opacity: 0, y: 24, rotate: -2 }}
            animate={{ opacity: 1, y: 0, rotate: 0 }}
            transition={{
              delay: 0.12,
              duration: 0.65,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            <div className="auth-preview-heading">
              <span>
                <Apple size={16} />
                {l("Моя кухня", "My kitchen")}
              </span>
              <span className="preview-demo">{l("Пример", "Preview")}</span>
            </div>
            <div className="auth-preview-grid">
              <div className="preview-food">
                <img
                  src="/images/strawberry.jpg"
                  alt={l("Свежая клубника", "Fresh strawberries")}
                />
                <span>
                  <strong>{l("Клубника", "Strawberries")}</strong>
                  <small>
                    {l("Сначала самое свежее", "Freshness in focus")}
                  </small>
                </span>
                <i>
                  <Clock3 size={14} />
                </i>
              </div>
              <div className="preview-food">
                <img
                  src="/images/bread.jpg"
                  alt={l("Свежий хлеб", "Fresh bread")}
                />
                <span>
                  <strong>{l("Хлеб на закваске", "Sourdough bread")}</strong>
                  <small>
                    {l("Всё на своей полке", "Everything in its place")}
                  </small>
                </span>
                <i>
                  <Check size={14} />
                </i>
              </div>
            </div>
            <div className="preview-insight">
              <span>
                <ChefHat size={19} />
              </span>
              <div>
                <strong>
                  {l("Что приготовить сегодня?", "What’s for dinner?")}
                </strong>
                <p>
                  {l(
                    "Идеи из того, что уже есть дома.",
                    "Ideas from what you already have.",
                  )}
                </p>
              </div>
              <ArrowRight size={18} />
            </div>
          </motion.div>
          <div className="auth-feature-row">
            <span>
              <Package size={16} />
              {l("Умный учёт", "Smart inventory")}
            </span>
            <span>
              <Clock3 size={16} />
              {l("Контроль сроков", "Expiry tracking")}
            </span>
            <span>
              <ChefHat size={16} />
              {l("Идеи блюд", "Meal ideas")}
            </span>
          </div>
          <div className="auth-story-footer">
            <span>SHELF SENSE</span>
            <span>
              {l(
                "Каждая покупка имеет значение.",
                "Make every purchase count.",
              )}
            </span>
          </div>
        </section>
        <section className="auth-form-area">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <MagicCard>
              <div className="auth-card-content">
                <span className="auth-welcome-icon">
                  <Apple size={25} />
                </span>
                <h2>{l("Добро пожаловать", "Welcome to Shelf Sense")}</h2>
                <p>
                  {l(
                    "Войдите или создайте личное пространство.",
                    "Sign in or create your personal workspace.",
                  )}
                </p>
                <div
                  className="auth-tabs"
                  role="group"
                  aria-label={l("Режим входа", "Access mode")}
                >
                  {(["register", "login"] as const).map((v) => (
                    <button
                      key={v}
                      aria-pressed={mode === v}
                      onClick={() => {
                        setMode(v);
                        setError("");
                      }}
                    >
                      {v === "register"
                        ? l("Создать профиль", "Create profile")
                        : l("Войти", "Sign in")}
                    </button>
                  ))}
                </div>
                <form onSubmit={submit}>
                  <label htmlFor="nickname">{l("Никнейм", "Nickname")}</label>
                  <input
                    id="nickname"
                    autoComplete="nickname"
                    placeholder="darbanov_8"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    minLength={2}
                    maxLength={32}
                    required
                  />
                  <label htmlFor="email">Email</label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    maxLength={254}
                    required
                  />
                  <label htmlFor="password">{l("Пароль", "Password")}</label>
                  <div className="password-field">
                    <input
                      id="password"
                      type={visible ? "text" : "password"}
                      autoComplete={
                        mode === "register"
                          ? "new-password"
                          : "current-password"
                      }
                      placeholder={l(
                        "Не менее 8 символов",
                        "At least 8 characters",
                      )}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      minLength={8}
                      maxLength={128}
                      required
                    />
                    <button
                      type="button"
                      aria-label={
                        visible
                          ? l("Скрыть пароль", "Hide password")
                          : l("Показать пароль", "Show password")
                      }
                      onClick={() => setVisible(!visible)}
                    >
                      {visible ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {error && (
                    <p className="field-error" role="alert">
                      {messages[error] ?? messages.unavailable}
                    </p>
                  )}
                  <button
                    className="button primary auth-submit"
                    disabled={busy || loading}
                  >
                    {loading
                      ? l("Загрузка…", "Loading…")
                      : busy
                        ? l("Открываем кухню…", "Opening your kitchen…")
                        : mode === "register"
                          ? l("Создать мою кухню", "Create my kitchen")
                          : l("Войти в мою кухню", "Enter my kitchen")}
                    <ArrowRight size={18} />
                  </button>
                </form>
                <p className="auth-privacy">
                  <ShieldCheck size={16} />
                  {l(
                    "Профиль и запасы сохраняются в вашем аккаунте.",
                    "Your profile and inventory are saved to your account.",
                  )}
                </p>
              </div>
            </MagicCard>
          </motion.div>
          <p className="auth-signature">SHELF SENSE · PERSONAL WORKSPACE</p>
        </section>
      </div>
    </main>
  );
}
