import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { UPLOAD_LIMITS } from "./config";
import { LISTING_SELECT, toListing } from "./mappers";
import type { Listing, ListingDraft } from "./types";
import { firstError, isAllowedMediaUrl, listingSchema, safeNextPath, TITLE_MAX } from "./validation";

const NOT_VERIFIED = { ok: false as const, error: "Verify your identity to continue." };

const filtersSchema = z.object({
  q: z.string().max(100).optional(),
  category: z.string().max(30).optional(),
  location: z.string().max(60).optional(),
  maxPrice: z.number().min(0).max(1_000_000).optional(),
  limit: z.number().int().min(1).max(200).optional(),
});
export type ListingFilters = z.infer<typeof filtersSchema>;

/** Public browse list: available listings, newest first, same filters as the original store. */
export const listListings = createServerFn({ method: "GET" })
  .inputValidator((d: ListingFilters) => filtersSchema.parse(d ?? {}))
  .handler(async ({ data }): Promise<Listing[]> => {
    const { createPublicClient } = await import("@/server/public-client.server");
    const sb = createPublicClient();
    let query = sb.from("listings").select(LISTING_SELECT).eq("available", true).order("created_at", { ascending: false }).limit(500);
    if (data.category) query = query.eq("category", data.category);
    if (data.location) query = query.eq("location", data.location);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    const q = data.q?.trim().toLowerCase();
    return rows
      .map(toListing)
      .filter((l) => !data.maxPrice || (l.dailyRate ?? l.flatRate ?? l.hourlyRate ?? 0) <= data.maxPrice)
      .filter(
        (l) =>
          !q ||
          l.title.toLowerCase().includes(q) ||
          l.description.toLowerCase().includes(q) ||
          l.tags.some((t) => t.toLowerCase().includes(q)),
      )
      .slice(0, data.limit ?? 200);
  });

export const getListing = createServerFn({ method: "GET" })
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }): Promise<Listing | null> => {
    const { createPublicClient } = await import("@/server/public-client.server");
    const { data: row } = await createPublicClient().from("listings").select(LISTING_SELECT).eq("id", data.id).maybeSingle();
    return row ? toListing(row) : null;
  });

export const getMyListings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Listing[]> => {
    const { data, error } = await context.supabase
      .from("listings")
      .select(LISTING_SELECT)
      .eq("owner_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data.map(toListing);
  });

const draftSchema = z.object({
  title: z.string().max(TITLE_MAX).default(""),
  category: z.string().max(30).default(""),
  condition: z.string().max(20).default(""),
  description: z.string().max(2000).default(""),
  tags: z.array(z.string().max(24)).max(10).default([]),
  hourlyRate: z.number().nullable().default(null),
  dailyRate: z.number().nullable().default(null),
  flatRate: z.number().nullable().default(null),
  quantity: z.number().int().min(0).max(99).default(1),
  deposit: z.number().min(0).max(1_000_000).default(0),
  available: z.boolean().default(true),
  rules: z.array(z.string().max(200)).max(20).default([]),
  agreementTemplate: z.string().max(30).default("standard"),
  media: z
    .array(z.object({ url: z.string().max(300), type: z.enum(["image", "video"]) }))
    .max(UPLOAD_LIMITS.maxFiles)
    .default([]),
  location: z.string().max(60).default(""),
});

export const getDraft = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ draft: ListingDraft; updatedAt: string } | null> => {
    const { data } = await context.supabase.from("listing_drafts").select("*").eq("user_id", context.userId).maybeSingle();
    if (!data) return null;
    const parsed = draftSchema.safeParse(data.data);
    return parsed.success ? { draft: parsed.data as ListingDraft, updatedAt: data.updated_at } : null;
  });

export const saveDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: ListingDraft) => draftSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { getVerifiedMember } = await import("@/server/member.server");
    if (!(await getVerifiedMember(context.supabase, context.userId))) return NOT_VERIFIED;
    const updatedAt = new Date().toISOString();
    const { error } = await context.supabase
      .from("listing_drafts")
      .upsert({ user_id: context.userId, data, updated_at: updatedAt });
    if (error) return { ok: false as const, error: "Could not save your draft." };
    return { ok: true as const, savedAt: updatedAt };
  });

export const publishListing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d)
  .handler(async ({ data, context }) => {
    const { getVerifiedMember } = await import("@/server/member.server");
    if (!(await getVerifiedMember(context.supabase, context.userId))) return NOT_VERIFIED;

    const parsed = listingSchema.safeParse(data);
    if (!parsed.success) {
      return { ok: false as const, error: "Fix the highlighted fields.", fieldErrors: firstError(parsed.error) };
    }
    const l = parsed.data;
    if (!l.media.every((m) => isAllowedMediaUrl(m.url, context.userId))) {
      return { ok: false as const, error: "Fix the highlighted fields.", fieldErrors: { media: "Upload your own photos" } };
    }
    const { data: row, error } = await context.supabase
      .from("listings")
      .insert({
        owner_id: context.userId,
        title: l.title,
        category: l.category,
        condition: l.condition,
        description: l.description,
        tags: l.tags,
        hourly_rate: l.hourlyRate,
        daily_rate: l.dailyRate,
        flat_rate: l.flatRate,
        quantity: l.quantity,
        deposit: l.deposit,
        available: l.available,
        rules: l.rules,
        agreement_template: l.agreementTemplate,
        media: l.media,
        location: l.location,
      })
      .select("id")
      .single();
    if (error) {
      console.error("[publishListing]", error);
      return { ok: false as const, error: "Could not publish your listing. Try again." };
    }
    await context.supabase.from("listing_drafts").delete().eq("user_id", context.userId);
    return { ok: true as const, id: row.id };
  });

export const toggleListingAvailability = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("listings")
      .select("available")
      .eq("id", data.id)
      .eq("owner_id", context.userId)
      .maybeSingle();
    if (!row) return { ok: false as const };
    const { error } = await context.supabase
      .from("listings")
      .update({ available: !row.available })
      .eq("id", data.id)
      .eq("owner_id", context.userId);
    return { ok: !error };
  });

export const deleteListing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("listings").delete().eq("id", data.id).eq("owner_id", context.userId);
    return { ok: !error };
  });

export const getSavedIds = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<string[]> => {
    const { data } = await context.supabase.from("favorites").select("listing_id").eq("user_id", context.userId);
    return (data ?? []).map((r) => r.listing_id);
  });

export const getSavedListings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Listing[]> => {
    const { data, error } = await context.supabase
      .from("favorites")
      .select(`created_at, listing:listings(${LISTING_SELECT})`)
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data.flatMap((r) => (r.listing ? [toListing(r.listing)] : []));
  });

export const toggleSaved = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { listingId: string }) => z.object({ listingId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { getVerifiedMember } = await import("@/server/member.server");
    if (!(await getVerifiedMember(context.supabase, context.userId))) return NOT_VERIFIED;
    const { data: existing } = await context.supabase
      .from("favorites")
      .select("listing_id")
      .eq("user_id", context.userId)
      .eq("listing_id", data.listingId)
      .maybeSingle();
    if (existing) {
      await context.supabase.from("favorites").delete().eq("user_id", context.userId).eq("listing_id", data.listingId);
      return { ok: true as const, saved: false };
    }
    const { error } = await context.supabase.from("favorites").insert({ user_id: context.userId, listing_id: data.listingId });
    if (error) return { ok: false as const, error: "Listing not found." };
    return { ok: true as const, saved: true };
  });

/** Starts Stripe Connect onboarding (or marks connected in mock mode) and returns where to go next. */
export const connectStripe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { returnPath: string }) => z.object({ returnPath: z.string().max(200) }).parse(d))
  .handler(async ({ data, context }) => {
    const { getVerifiedMember } = await import("@/server/member.server");
    const member = await getVerifiedMember(context.supabase, context.userId);
    if (!member) return NOT_VERIFIED;
    const request = getRequest();
    const origin = request.headers.get("origin") ?? new URL(request.url).origin;
    const safePath = safeNextPath(data.returnPath, "/my-listings");
    const stripe = await import("@/server/stripe.server");
    try {
      const result = await stripe.startConnectOnboarding({
        existingAccountId: member.stripe_account_id,
        returnUrl: `${origin}${safePath}`,
      });
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin
        .from("member_private")
        .update({ stripe_account_id: result.accountId, stripe_connected: result.connected })
        .eq("user_id", context.userId);
      return { ok: true as const, url: result.url, connected: result.connected, mock: stripe.isMockStripe() };
    } catch {
      return { ok: false as const, error: "Stripe is unavailable right now. Try again shortly." };
    }
  });
