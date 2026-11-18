import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { BRAND, CAMPUS_LOCATIONS, CATEGORIES, CONDITIONS } from "./config";
import { LISTING_SELECT, toListing } from "./mappers";
import type { Listing, RentalStatus } from "./types";

type Fail = { ok: false; error: string };
const pass = z.string().max(200);

async function guard(context: { supabase: Parameters<typeof import("@/server/admin.server").requireAdmin>[0]; userId: string }, passcode: string): Promise<Fail | null> {
  const { requireAdmin, AdminError } = await import("@/server/admin.server");
  try {
    await requireAdmin(context.supabase, context.userId, passcode);
    return null;
  } catch (e) {
    return { ok: false, error: e instanceof AdminError ? e.message : "Admins only." };
  }
}

export type AdminOverview = {
  members: number;
  verifiedMembers: number;
  suspendedMembers: number;
  liveListings: number;
  pausedListings: number;
  rentalsByStatus: Record<RentalStatus, number>;
  feesEarned: number;
};

export type AdminMember = {
  id: string;
  name: string;
  phone: string;
  verified: boolean;
  suspended: boolean;
  isAdmin: boolean;
  listings: number;
  joinedAt: string;
};

export type AdminRental = {
  id: string;
  listingTitle: string;
  borrowerName: string;
  ownerName: string;
  startDate: string;
  endDate: string;
  subtotal: number;
  fee: number;
  status: RentalStatus;
  createdAt: string;
};

/** Checks the admin password; the admin page calls this before showing anything. */
export const adminUnlock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { passcode: string }) => z.object({ passcode: pass }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true } | Fail> => (await guard(context, data.passcode)) ?? { ok: true });

export const adminGetOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { passcode: string }) => z.object({ passcode: pass }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true; overview: AdminOverview } | Fail> => {
    const denied = await guard(context, data.passcode);
    if (denied) return denied;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [members, listings, rentals] = await Promise.all([
      supabaseAdmin.from("member_private").select("verified_at, suspended_at"),
      supabaseAdmin.from("listings").select("available"),
      supabaseAdmin.from("rentals").select("status, fee"),
    ]);
    const rentalsByStatus: Record<RentalStatus, number> = { pending: 0, accepted: 0, declined: 0, cancelled: 0, completed: 0 };
    let feesEarned = 0;
    for (const r of rentals.data ?? []) {
      rentalsByStatus[r.status as RentalStatus] = (rentalsByStatus[r.status as RentalStatus] ?? 0) + 1;
      if (r.status === "accepted" || r.status === "completed") feesEarned += Number(r.fee);
    }
    const m = members.data ?? [];
    const l = listings.data ?? [];
    return {
      ok: true,
      overview: {
        members: m.length,
        verifiedMembers: m.filter((x) => x.verified_at).length,
        suspendedMembers: m.filter((x) => x.suspended_at).length,
        liveListings: l.filter((x) => x.available).length,
        pausedListings: l.filter((x) => !x.available).length,
        rentalsByStatus,
        feesEarned,
      },
    };
  });

export const adminListListings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { passcode: string }) => z.object({ passcode: pass }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true; listings: Listing[] } | Fail> => {
    const denied = await guard(context, data.passcode);
    if (denied) return denied;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.from("listings").select(LISTING_SELECT).order("created_at", { ascending: false }).limit(1000);
    if (error) return { ok: false, error: "Could not load listings." };
    return { ok: true, listings: rows.map(toListing) };
  });

const money = z.number().min(0).max(1_000_000).nullable();
export const adminListingEditSchema = z
  .object({
    title: z.string().trim().min(3, "Title needs at least 3 characters").max(100),
    description: z.string().trim().min(10, "Description needs at least 10 characters").max(2000),
    category: z.enum(CATEGORIES.map((c) => c.value) as [string, ...string[]]),
    condition: z.enum(CONDITIONS as unknown as [string, ...string[]]),
    location: z.enum(CAMPUS_LOCATIONS as unknown as [string, ...string[]]),
    dailyRate: money,
    hourlyRate: money,
    flatRate: money,
    deposit: z.number().min(0).max(1_000_000),
    quantity: z.number().int().min(1).max(99),
    available: z.boolean(),
  })
  .refine((v) => !!(v.dailyRate || v.hourlyRate || v.flatRate), { message: "Set at least one price", path: ["dailyRate"] });
export type AdminListingEdit = z.infer<typeof adminListingEditSchema>;

export const adminUpdateListing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { passcode: string; id: string; changes: AdminListingEdit }) =>
    z.object({ passcode: pass, id: z.string().uuid(), changes: adminListingEditSchema }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{ ok: true } | Fail> => {
    const denied = await guard(context, data.passcode);
    if (denied) return denied;
    const c = data.changes;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("listings")
      .update({
        title: c.title,
        description: c.description,
        category: c.category,
        condition: c.condition,
        location: c.location,
        daily_rate: c.dailyRate,
        hourly_rate: c.hourlyRate,
        flat_rate: c.flatRate,
        deposit: c.deposit,
        quantity: c.quantity,
        available: c.available,
      })
      .eq("id", data.id);
    return error ? { ok: false, error: "Could not save the listing." } : { ok: true };
  });

export const adminDeleteListing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { passcode: string; id: string }) => z.object({ passcode: pass, id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true } | Fail> => {
    const denied = await guard(context, data.passcode);
    if (denied) return denied;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("listings").delete().eq("id", data.id);
    if (error) console.error("[adminDeleteListing]", error);
    return error ? { ok: false, error: "Could not remove the listing." } : { ok: true };
  });

export const adminListMembers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { passcode: string }) => z.object({ passcode: pass }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true; members: AdminMember[] } | Fail> => {
    const denied = await guard(context, data.passcode);
    if (denied) return denied;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [priv, profiles, listings, roles] = await Promise.all([
      supabaseAdmin.from("member_private").select("user_id, phone, verified_at, suspended_at, created_at").order("created_at", { ascending: false }),
      supabaseAdmin.from("profiles").select("id, display_name"),
      supabaseAdmin.from("listings").select("owner_id"),
      supabaseAdmin.from("user_roles").select("user_id").eq("role", "admin"),
    ]);
    const names = new Map((profiles.data ?? []).map((p) => [p.id, p.display_name]));
    const counts = new Map<string, number>();
    for (const l of listings.data ?? []) counts.set(l.owner_id, (counts.get(l.owner_id) ?? 0) + 1);
    const admins = new Set((roles.data ?? []).map((r) => r.user_id));
    return {
      ok: true,
      members: (priv.data ?? []).map((m) => ({
        id: m.user_id,
        name: names.get(m.user_id) || "Not set yet",
        phone: m.phone,
        verified: !!m.verified_at,
        suspended: !!m.suspended_at,
        isAdmin: admins.has(m.user_id),
        listings: counts.get(m.user_id) ?? 0,
        joinedAt: m.created_at,
      })),
    };
  });

/** Suspending blocks sign-in and every member action, and pauses all of the member's listings. */
export const adminSetSuspended = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { passcode: string; userId: string; suspended: boolean }) =>
    z.object({ passcode: pass, userId: z.string().uuid(), suspended: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{ ok: true } | Fail> => {
    const denied = await guard(context, data.passcode);
    if (denied) return denied;
    if (data.userId === context.userId) return { ok: false, error: "You can't suspend your own account." };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("member_private")
      .update({ suspended_at: data.suspended ? new Date().toISOString() : null })
      .eq("user_id", data.userId);
    if (error) return { ok: false, error: "Could not update the member." };
    if (data.suspended) {
      await supabaseAdmin.from("listings").update({ available: false }).eq("owner_id", data.userId);
    }
    return { ok: true };
  });

export const adminListRentals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { passcode: string }) => z.object({ passcode: pass }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true; rentals: AdminRental[] } | Fail> => {
    const denied = await guard(context, data.passcode);
    if (denied) return denied;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("rentals")
      .select("*, borrower:profiles!rentals_borrower_id_fkey(display_name), owner:profiles!rentals_owner_id_fkey(display_name)")
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) return { ok: false, error: "Could not load rentals." };
    return {
      ok: true,
      rentals: rows.map((r) => ({
        id: r.id,
        listingTitle: r.listing_title,
        borrowerName: r.borrower?.display_name || "Campus member",
        ownerName: r.owner?.display_name || "Campus member",
        startDate: r.start_date,
        endDate: r.end_date,
        subtotal: Number(r.subtotal),
        fee: Number(r.fee),
        status: r.status as RentalStatus,
        createdAt: r.created_at,
      })),
    };
  });

export const adminCancelRental = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { passcode: string; id: string }) => z.object({ passcode: pass, id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true } | Fail> => {
    const denied = await guard(context, data.passcode);
    if (denied) return denied;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rental } = await supabaseAdmin.from("rentals").select("*").eq("id", data.id).maybeSingle();
    if (!rental || (rental.status !== "pending" && rental.status !== "accepted")) {
      return { ok: false, error: "Only pending or accepted rentals can be cancelled." };
    }
    const { error } = await supabaseAdmin.from("rentals").update({ status: "cancelled" }).eq("id", data.id).eq("status", rental.status);
    if (error) return { ok: false, error: "Could not cancel the rental." };
    const { notify } = await import("@/server/member.server");
    const n = { title: "Rental cancelled", body: `The rental for "${rental.listing_title}" was cancelled by the ${BRAND.name} team.`, href: "/my-rentals" };
    await Promise.all([notify(supabaseAdmin, rental.borrower_id, n), notify(supabaseAdmin, rental.owner_id, n)]);
    return { ok: true };
  });
