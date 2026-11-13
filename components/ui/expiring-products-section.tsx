"use client";
import { ExpiringProductCard } from "./expiring-product-card";
import type { Product } from "@/app/lib/model";
import type { Lang } from "@/app/lib/catalog";
export function ExpiringProductsSection({
  products,
  lang,
  today,
  layout,
  onEdit,
  onUse,
  onDiscard,
  onRestore,
}: {
  products: Product[];
  lang: Lang;
  today: string;
  layout: "grid" | "list";
  onEdit: (p: Product) => void;
  onUse: (p: Product) => void;
  onDiscard: (p: Product) => void;
  onRestore: (id: string) => void;
}) {
  return (
    <div className={`product-grid ${layout === "list" ? "list-layout" : ""}`}>
      {products.map((p, index) => (
        <ExpiringProductCard
          key={p.id}
          product={p}
          lang={lang}
          today={today}
          index={index}
          onEdit={() => onEdit(p)}
          onUse={() => onUse(p)}
          onDiscard={() => onDiscard(p)}
          onRestore={() => onRestore(p.id)}
        />
      ))}
    </div>
  );
}
