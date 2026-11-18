import { z } from "zod";
import { AGREEMENT_TEMPLATES, CAMPUS_LOCATIONS, CATEGORIES, CONDITIONS, MEDIA_ROUTE_PREFIX, UPLOAD_LIMITS } from "./config";

export const TITLE_MAX = 100;
export const DESCRIPTION_MIN = 20;
export const DESCRIPTION_MAX = 2000;

const rate = z.number().min(0).max(1_000_000).nullable();

/** Uploaded media is served from the app's media route; bundled sample photos from the asset CDN path. */
export function isAllowedMediaUrl(url: string, ownerId?: string) {
  if (url.startsWith("/__l5e/assets-v1/")) return true;
  const m = /^\/api\/public\/media\/([0-9a-f-]{36})\/[0-9a-f-]{36}\.(png|jpe?g|webp|mp4)$/i.exec(url);
  if (!m || !url.startsWith(MEDIA_ROUTE_PREFIX)) return false;
  return ownerId ? m[1] === ownerId : true;
}

const mediaUrl = z.string().max(300).refine((url) => isAllowedMediaUrl(url), "Unsupported media location");

const categoryValues = CATEGORIES.map((c) => c.value) as [string, ...string[]];
const agreementValues = AGREEMENT_TEMPLATES.map((t) => t.value) as [string, ...string[]];

export const detailsSchema = z.object({
  title: z.string().trim().min(3, "Add a title (at least 3 characters)").max(TITLE_MAX, `Keep it under ${TITLE_MAX} characters`),
  category: z.enum(categoryValues, { errorMap: () => ({ message: "Pick a category" }) }),
  condition: z.enum(CONDITIONS, { errorMap: () => ({ message: "Pick a condition" }) }),
  description: z
    .string()
    .trim()
    .min(DESCRIPTION_MIN, `Description needs at least ${DESCRIPTION_MIN} characters`)
    .max(DESCRIPTION_MAX),
  tags: z.array(z.string().trim().min(1).max(24)).max(10, "Up to 10 tags"),
});

export const pricingSchema = z
  .object({
    hourlyRate: rate,
    dailyRate: rate,
    flatRate: rate,
    quantity: z.number().int("Whole numbers only").min(1, "At least 1").max(99),
    deposit: z.number().min(0).max(1_000_000),
    available: z.boolean(),
    rules: z.array(z.string().trim().min(1).max(200)).max(20, "Up to 20 rules"),
    agreementTemplate: z.enum(agreementValues),
  })
  .refine((p) => (p.hourlyRate ?? 0) > 0 || (p.dailyRate ?? 0) > 0 || (p.flatRate ?? 0) > 0, {
    message: "Set at least one rate (hourly, daily or flat)",
    path: ["dailyRate"],
  });

export const photosSchema = z.object({
  media: z
    .array(z.object({ url: mediaUrl, type: z.enum(["image", "video"]) }))
    .max(UPLOAD_LIMITS.maxFiles, `Up to ${UPLOAD_LIMITS.maxFiles} files`)
    .refine((m) => m.some((x) => x.type === "image"), "Add at least one high-quality image"),
});

export const locationSchema = z.object({
  location: z.enum(CAMPUS_LOCATIONS, { errorMap: () => ({ message: "Choose a pickup spot on campus" }) }),
});

export const listingSchema = z.intersection(
  z.intersection(detailsSchema, pricingSchema),
  z.intersection(photosSchema, locationSchema),
);

export type ListingInput = z.infer<typeof listingSchema>;

export function normalizePhone(raw: string) {
  const cleaned = raw.replace(/[\s()-]/g, "");
  if (/^[6-9]\d{9}$/.test(cleaned)) return `+91${cleaned}`;
  if (/^\+[1-9]\d{7,14}$/.test(cleaned)) return cleaned;
  return null;
}

export function firstError(error: z.ZodError) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    fieldErrors[key] ??= issue.message;
  }
  return fieldErrors;
}

export function safeNextPath(next: unknown, fallback = "/browse") {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : fallback;
}
