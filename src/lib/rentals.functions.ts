import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { formatMoney } from "./config";
import { daysBetween, rentalQuote } from "./pricing";
import type { Rental, RentalStatus } from "./types";

const requestSchema = z.object({
  listingId: z.string().uuid(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  quantity: z.number().int().min(1).max(99),
  note: z.string().trim().max(500),
});

/** Availability rule: pending + accepted rentals that overlap the requested dates count against quantity. */
export function remainingQuantity(
  listingQuantity: number,
  existing: { startDate: string; endDate: string; quantity: number; status: RentalStatus }[],
  start: string,
  end: string,
) {
  const booked = existing
    .filter((r) => r.status === "pending" || r.status === "accepted")
    .filter((r) => r.startDate <= end && start <= r.endDate)
    .reduce((sum, r) => sum + r.quantity, 0);
  return Math.max(0, listingQuantity - booked);
}

export const requestRental = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof requestSchema>) => requestSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { getVerifiedMember, getDisplayName, notify } = await import("@/server/member.server");
    if (!(await getVerifiedMember(context.supabase, context.userId))) {
      return { ok: false as const, error: "Verify your identity to rent items." };
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { listingId, startDate, endDate, quantity, note } = data;

    const { data: listing } = await supabaseAdmin.from("listings").select("*").eq("id", listingId).maybeSingle();
    if (!listing || !listing.available) return { ok: false as const, error: "This item is not available right now." };
    if (listing.owner_id === context.userId) return { ok: false as const, error: "You cannot rent your own item." };

    const today = new Date().toISOString().slice(0, 10);
    const days = daysBetween(startDate, endDate);
    if (startDate < today || days < 1 || days > 60) {
      return { ok: false as const, error: "Pick dates from today, up to 60 days." };
    }

    const { data: existing } = await supabaseAdmin
      .from("rentals")
      .select("start_date, end_date, quantity, status")
      .eq("listing_id", listingId)
      .in("status", ["pending", "accepted"]);
    const left = remainingQuantity(
      listing.quantity,
      (existing ?? []).map((r) => ({
        startDate: r.start_date,
        endDate: r.end_date,
        quantity: r.quantity,
        status: r.status as RentalStatus,
      })),
      startDate,
      endDate,
    );
    if (quantity > left) {
      return { ok: false as const, error: left ? `Only ${left} available for those dates.` : "Fully booked for those dates." };
    }

    const quote = rentalQuote(
      {
        dailyRate: listing.daily_rate === null ? null : Number(listing.daily_rate),
        hourlyRate: listing.hourly_rate === null ? null : Number(listing.hourly_rate),
        flatRate: listing.flat_rate === null ? null : Number(listing.flat_rate),
        deposit: Number(listing.deposit),
      },
      days,
      quantity,
    );
    const { data: rental, error } = await supabaseAdmin
      .from("rentals")
      .insert({
        listing_id: listingId,
        listing_title: listing.title,
        borrower_id: context.userId,
        owner_id: listing.owner_id,
        start_date: startDate,
        end_date: endDate,
        days,
        quantity,
        subtotal: quote.subtotal,
        fee: quote.fee,
        deposit: quote.deposit,
        status: "pending",
        note,
      })
      .select("id")
      .single();
    if (error) {
      console.error("[requestRental]", error);
      return { ok: false as const, error: "Could not send your request. Try again." };
    }
    const name = await getDisplayName(supabaseAdmin, context.userId);
    await notify(supabaseAdmin, listing.owner_id, {
      title: "New rental request",
      body: `${name} wants "${listing.title}" for ${days} day${days > 1 ? "s" : ""} (${formatMoney(quote.subtotal)}).`,
      href: "/my-rentals?tab=requests",
    });
    return { ok: true as const, id: rental.id };
  });

type Transition = "accept" | "decline" | "cancel" | "complete";

export const updateRental = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; action: Transition }) =>
    z.object({ id: z.string().uuid(), action: z.enum(["accept", "decline", "cancel", "complete"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { getVerifiedMember, notify } = await import("@/server/member.server");
    if (!(await getVerifiedMember(context.supabase, context.userId))) return { ok: false as const };
    // Read through RLS so only participants can act.
    const { data: rental } = await context.supabase.from("rentals").select("*").eq("id", data.id).maybeSingle();
    if (!rental) return { ok: false as const };

    const isOwner = rental.owner_id === context.userId;
    const isBorrower = rental.borrower_id === context.userId;
    let next: RentalStatus | null = null;
    if ((data.action === "accept" || data.action === "decline") && isOwner && rental.status === "pending") {
      next = data.action === "accept" ? "accepted" : "declined";
    } else if (data.action === "cancel" && isBorrower && rental.status === "pending") {
      next = "cancelled";
    } else if (data.action === "complete" && isOwner && rental.status === "accepted") {
      next = "completed";
    }
    if (!next) return { ok: false as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("rentals").update({ status: next }).eq("id", data.id).eq("status", rental.status);
    if (error) return { ok: false as const };
    if (next === "accepted" || next === "declined") {
      const accept = next === "accepted";
      await notify(supabaseAdmin, rental.borrower_id, {
        title: accept ? "Rental accepted" : "Rental declined",
        body: `Your request for "${rental.listing_title}" was ${accept ? "accepted. Meet at the pickup spot" : "declined"}.`,
        href: "/my-rentals",
      });
    }
    return { ok: true as const, status: next };
  });

export const getMyRentals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ borrowing: Rental[]; requests: Rental[] }> => {
    const { data, error } = await context.supabase
      .from("rentals")
      .select(
        "*, borrower:profiles!rentals_borrower_id_fkey(display_name), owner:profiles!rentals_owner_id_fkey(display_name)",
      )
      .or(`borrower_id.eq.${context.userId},owner_id.eq.${context.userId}`)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const all: Rental[] = data.map((r) => ({
      id: r.id,
      listingId: r.listing_id,
      listingTitle: r.listing_title,
      borrowerId: r.borrower_id,
      borrowerName: r.borrower?.display_name || "Campus member",
      ownerId: r.owner_id,
      ownerName: r.owner?.display_name || "Campus member",
      startDate: r.start_date,
      endDate: r.end_date,
      days: r.days,
      quantity: r.quantity,
      subtotal: Number(r.subtotal),
      fee: Number(r.fee),
      deposit: Number(r.deposit),
      status: r.status as RentalStatus,
      note: r.note,
      createdAt: r.created_at,
    }));
    return {
      borrowing: all.filter((r) => r.borrowerId === context.userId),
      requests: all.filter((r) => r.ownerId === context.userId),
    };
  });
