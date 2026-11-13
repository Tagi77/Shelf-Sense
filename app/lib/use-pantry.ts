"use client";
import { useEffect, useRef, useState } from "react";
import { storedSchema, STORAGE_KEY, type Product } from "./model";
import { InventoryConflict } from "./inventory";
type Snapshot = { products: Product[] | null; revision: number };
export function usePantry(accountId: string) {
  const storageKey = `${STORAGE_KEY}.${accountId}`;
  const [products, setProducts] = useState<Product[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<
    "unavailable" | "corrupt" | "conflict" | null
  >(null);
  const [saving, setSaving] = useState(false);
  const busy = useRef(false),
    revision = useRef(0),
    mounted = useRef(true),
    corrupt = useRef(false);
  const apply = (data: Snapshot) => {
    if (
      !data.products ||
      !mounted.current ||
      data.revision < revision.current ||
      corrupt.current
    )
      return;
    const parsed = storedSchema.parse({ version: 2, products: data.products });
    revision.current = data.revision;
    setProducts(parsed.products);
    // This is a cache only. A full browser never rolls back a server write.
    try {
      localStorage.setItem(storageKey, JSON.stringify(parsed));
    } catch {}
  };
  async function read(): Promise<Snapshot> {
    const response = await fetch("/api/pantry", {
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) throw Error("unavailable");
    return response.json();
  }
  useEffect(() => {
    mounted.current = true;
    let stopped = false;
    const init = async () => {
      try {
        let raw: string | null = null;
        try {
          raw = localStorage.getItem(storageKey);
        } catch (e) {
          if (e instanceof SyntaxError || (e as Error)?.name === "ZodError")
            throw Error("corrupt");
        }
        let local: Product[] | null = null;
        if (raw) {
          try {
            local = storedSchema.parse(JSON.parse(raw)).products;
          } catch {
            throw Error("corrupt");
          }
        }
        if (local && !stopped) setProducts(local);
        let remote = await read();
        if (!remote.products) {
          const response = await fetch("/api/pantry", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              revision: 0,
              products: local ?? [],
            }),
            signal: AbortSignal.timeout(12000),
          });
          if (!response.ok) throw Error("unavailable");
          remote = await response.json();
        }
        // Preserve the pre-cloud local copy, including devices with older edits.
        if (raw) {
          try {
            if (!localStorage.getItem(`${storageKey}.pre-cloud`))
              localStorage.setItem(`${storageKey}.pre-cloud`, raw);
          } catch {}
        }
        if (!stopped) {
          apply(remote);
          setError(null);
          setReady(true);
        }
      } catch (e) {
        if (!stopped) {
          corrupt.current = (e as Error).message === "corrupt";
          setError(corrupt.current ? "corrupt" : "unavailable");
          setReady(true);
        }
      }
    };
    void init();
    const refresh = async () => {
      if (busy.current || document.hidden || stopped || corrupt.current) return;
      try {
        const data = await read();
        if (stopped || busy.current) return;
        if (!data.products) {
          await init();
          return;
        }
        apply(data);
        setError(null);
      } catch {
        if (!stopped) setError("unavailable");
      }
    };
    const timer = setInterval(refresh, 5000);
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      stopped = true;
      mounted.current = false;
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [accountId, storageKey]);
  async function commit(update: (current: Product[]) => Product[]) {
    if (!ready || error === "corrupt" || busy.current) return false;
    busy.current = true;
    setSaving(true);
    try {
      const current = await read();
      if (!current.products) throw Error("unavailable");
      const next = storedSchema.parse({
        version: 2,
        products: update(current.products),
      });
      const response = await fetch("/api/pantry", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          revision: current.revision,
          products: next.products,
        }),
        signal: AbortSignal.timeout(12000),
      });
      if (response.status === 409) throw new InventoryConflict("Stock changed");
      if (!response.ok) throw Error("unavailable");
      apply(await response.json());
      setError(null);
      return true;
    } catch (e) {
      setError(e instanceof InventoryConflict ? "conflict" : "unavailable");
      try {
        apply(await read());
      } catch {}
      return false;
    } finally {
      busy.current = false;
      if (mounted.current) setSaving(false);
    }
  }
  return { products, ready, error, commit, saving };
}
