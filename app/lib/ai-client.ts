"use client";
import { useEffect, useState } from "react";
import { z } from "zod";
import type { Lang } from "./catalog";
import type { Product } from "./model";
export const inventoryPayload = (products: Product[]) =>
  products
    .filter((p) => p.state === "active" && p.amount > 0)
    .slice(0, 100)
    .map(
      ({
        id,
        name,
        category,
        amount,
        unit,
        expiresOn,
        zone,
        temperature,
        condition,
      }) => ({
        id,
        name,
        category,
        amount,
        unit,
        expiresOn,
        zone,
        temperature,
        condition,
      }),
    );
export function useAIStatus() {
  const [provider, setProvider] = useState("AI");
  const [connected, setConnected] = useState(false);
  const [checked, setChecked] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    fetch("/api/ai/status", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: any) => {
        if (live) setReason(data?.reason ?? null);
        if (live)
          setProvider(data?.provider === "Gemini" ? "Gemini" : "OpenAI");
        if (live)
          setConnected(
            z.object({ connected: z.boolean() }).safeParse(data).data
              ?.connected === true,
          );
      })
      .catch(() => {})
      .finally(() => {
        if (live) setChecked(true);
      });
    const onUnavailable = () => {
      setConnected(false);
      setReason("credits");
    };
    window.addEventListener("shelf-ai-quota", onUnavailable);
    return () => {
      window.removeEventListener("shelf-ai-quota", onUnavailable);
      live = false;
    };
  }, []);
  return { connected, checked, reason, provider };
}
export async function askAI<T>(
  action: string,
  payload: unknown,
  schema: z.ZodType<T>,
  signal?: AbortSignal,
): Promise<T> {
  const r = await fetch(`/api/ai/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(payload),
    signal,
  });
  const data = z
    .object({ error: z.string().optional(), data: z.unknown() })
    .parse(await r.json());
  if (!r.ok) {
    if (data.error === "provider_quota")
      window.dispatchEvent(new Event("shelf-ai-quota"));
    throw Error(data.error ?? "request_failed");
  }
  return schema.parse(data.data);
}
export const aiError = (lang: Lang) =>
  lang === "ru"
    ? "ИИ сейчас не ответил. Локальные подсказки доступны — попробуйте ещё раз позже."
    : "AI could not respond. Local suggestions are still available — try again later.";
function openImages(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("shelf-sense-images", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("images");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function cachedImage(key: string): Promise<string | null> {
  const db = await openImages();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("images");
    const r = tx.objectStore("images").get(key);
    r.onsuccess = () => resolve(r.result ?? null);
    r.onerror = () => reject(r.error);
    tx.oncomplete = () => db.close();
  });
}
async function storeImage(key: string, value: string) {
  const db = await openImages();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction("images", "readwrite");
    tx.objectStore("images").put(value, key);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}
const imageRequests = new Map<string, Promise<string>>();
export async function makeFoodImage(name: string, lang: Lang) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(name.trim().toLowerCase()),
  );
  const key =
    "ai:" +
    Array.from(new Uint8Array(digest))
      .map((n) => n.toString(16).padStart(2, "0"))
      .join("");
  if (await cachedImage(key)) return key;
  const running = imageRequests.get(key);
  if (running) return running;
  const job = (async () => {
    const r = await fetch("/api/ai/image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, lang }),
    });
    const raw = await r.json();
    if (!r.ok) {
      const failure = z.object({ error: z.string() }).safeParse(raw);
      throw Error(failure.success ? failure.data.error : "image_failed");
    }
    const data = z
      .object({
        image: z
          .string()
          .max(5000030)
          .regex(/^data:image\/(?:jpeg|png|webp);base64,[a-zA-Z0-9+/=]+$/),
      })
      .safeParse(raw);
    if (!data.success) throw Error("image_failed");
    await storeImage(key, data.data.image);
    return key;
  })();
  imageRequests.set(key, job);
  try {
    return await job;
  } finally {
    imageRequests.delete(key);
  }
}
