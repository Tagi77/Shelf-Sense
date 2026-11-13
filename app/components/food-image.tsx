"use client";
import { useEffect, useState } from "react";
import { cachedImage } from "../lib/ai-client";
import { categories, photoUrl, type Category } from "../lib/catalog";
export default function FoodImage({
  photo,
  alt,
  visual = "photo",
  category = "produce",
  className = "",
  eager = false,
}: {
  photo: string;
  alt: string;
  visual?: "photo" | "icon";
  category?: Category;
  className?: string;
  eager?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const [generated, setGenerated] = useState<string | null>(null);
  useEffect(() => {
    setFailed(false);
    setGenerated(null);
    let live = true;
    if (photo.startsWith("ai:"))
      cachedImage(photo)
        .then((src) => {
          if (live) setGenerated(src);
        })
        .catch(() => {});
    return () => {
      live = false;
    };
  }, [photo]);
  return visual === "icon" || (photo.startsWith("ai:") && !generated) ? (
    <div className={`food-emoji ${className}`} role="img" aria-label={alt}>
      {categories[category].icon}
    </div>
  ) : (
    <img
      className={`food-photo ${className}`}
      src={generated ?? (failed ? photoUrl(photo) : `/images/${photo}.jpg`)}
      alt={alt}
      loading={eager ? "eager" : "lazy"}
      onError={() => setFailed(true)}
      width={800}
      height={600}
    />
  );
}
