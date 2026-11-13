import { z } from "zod";
export const aiGuideSchema = z.object({
  name: z.string().max(100),
  category: z.enum(["dairy", "protein", "produce", "prepared", "pantry"]),
  zone: z.enum(["shelf", "fresh", "door", "drawer", "freezer", "pantry"]),
  temperature: z.enum(["fresh", "chilled", "cool", "room", "frozen"]),
  daysMin: z.number().int().min(1).max(365),
  daysMax: z.number().int().min(1).max(365),
  tip: z.string().max(1000),
  confidence: z.enum(["known", "estimate", "unknown"]),
  unit: z.enum(["g", "kg", "ml", "l", "pcs"]),
});
export const dishSchema = z.object({
  id: z.string().min(1).max(100),
  title: z.string().min(1).max(160),
  minutes: z.number().int().min(1).max(240),
  reason: z.string().max(500),
  ingredients: z
    .array(
      z.object({
        productId: z.string().max(100),
        name: z.string().max(100),
        amount: z.number().positive().max(100000),
        unit: z.enum(["g", "kg", "ml", "l", "pcs"]),
      }),
    )
    .min(1)
    .max(20),
  extras: z.array(z.string().max(160)).max(12),
  steps: z.array(z.string().max(600)).min(1).max(12),
  improvement: z.string().max(500),
});
export const kitchenSchema = z.object({
  message: z.string().max(1000),
  dishes: z.array(dishSchema).max(3),
});
export const adviceSchema = z.object({
  title: z.string().max(120),
  tips: z.array(z.string().max(500)).min(1).max(4),
});
export const chatSchema = z.object({ message: z.string().min(1).max(4000) });
export type Dish = z.infer<typeof dishSchema>;
export type KitchenResult = z.infer<typeof kitchenSchema>;
export type Advice = z.infer<typeof adviceSchema>;
const str = { type: "string" };
const num = { type: "number" };
const obj = (properties: Record<string, unknown>) => ({
  type: "object",
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});
const arr = (items: unknown) => ({ type: "array", items });
const en = (values: string[]) => ({ type: "string", enum: values });
export const responseSchemas = {
  chat: obj({ message: str }),
  guide: obj({
    name: str,
    category: en(["dairy", "protein", "produce", "prepared", "pantry"]),
    zone: en(["shelf", "fresh", "door", "drawer", "freezer", "pantry"]),
    temperature: en(["fresh", "chilled", "cool", "room", "frozen"]),
    daysMin: { type: "integer" },
    daysMax: { type: "integer" },
    tip: str,
    confidence: en(["known", "estimate", "unknown"]),
    unit: en(["g", "kg", "ml", "l", "pcs"]),
  }),
  kitchen: obj({
    message: str,
    dishes: arr(
      obj({
        id: str,
        title: str,
        minutes: { type: "integer" },
        reason: str,
        ingredients: arr(
          obj({
            productId: str,
            name: str,
            amount: num,
            unit: en(["g", "kg", "ml", "l", "pcs"]),
          }),
        ),
        extras: arr(str),
        steps: arr(str),
        improvement: str,
      }),
    ),
  }),
  advice: obj({ title: str, tips: arr(str) }),
};
