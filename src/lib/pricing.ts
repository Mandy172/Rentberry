import { formatMoney, PLATFORM_FEE_RATE } from "./config";

type Rates = { dailyRate: number | null; hourlyRate: number | null; flatRate: number | null };

export function primaryPrice(listing: Rates) {
  if (listing.dailyRate) return { amount: listing.dailyRate, unit: "day" as const };
  if (listing.hourlyRate) return { amount: listing.hourlyRate, unit: "hour" as const };
  if (listing.flatRate) return { amount: listing.flatRate, unit: "flat" as const };
  return null;
}

export function priceLabel(listing: Rates) {
  const p = primaryPrice(listing);
  if (!p) return "Price on request";
  return p.unit === "flat" ? `${formatMoney(p.amount)} flat` : `${formatMoney(p.amount)}/${p.unit}`;
}

/** Inclusive day count between two YYYY-MM-DD dates; 0 when invalid or reversed. */
export function daysBetween(start: string, end: string) {
  const s = Date.parse(`${start}T00:00:00Z`);
  const e = Date.parse(`${end}T00:00:00Z`);
  if (Number.isNaN(s) || Number.isNaN(e) || e < s) return 0;
  return Math.round((e - s) / 86_400_000) + 1;
}

/** Server-authoritative quote. Daily rate wins, then flat, then hourly (assumes an 8-hour day). */
export function rentalQuote(listing: Rates & { deposit: number }, days: number, quantity: number) {
  let unitTotal = 0;
  if (listing.dailyRate) unitTotal = listing.dailyRate * days;
  else if (listing.flatRate) unitTotal = listing.flatRate;
  else if (listing.hourlyRate) unitTotal = listing.hourlyRate * 8 * days;
  const subtotal = Math.round(unitTotal * quantity * 100) / 100;
  const fee = Math.round(subtotal * PLATFORM_FEE_RATE * 100) / 100;
  return { subtotal, fee, ownerPayout: subtotal - fee, deposit: listing.deposit * quantity };
}

export function estimateEarnings(dailyPrice: number, daysPerMonth: number) {
  const gross = Math.max(0, dailyPrice) * Math.max(0, daysPerMonth);
  const fee = gross * PLATFORM_FEE_RATE;
  return { gross, fee, net: gross - fee };
}
