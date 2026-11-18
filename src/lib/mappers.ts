import type { Listing, Media } from "./types";
import type { CategoryValue } from "./config";

type ListingRow = {
  id: string;
  owner_id: string;
  title: string;
  category: string;
  condition: string;
  description: string;
  tags: string[];
  hourly_rate: number | null;
  daily_rate: number | null;
  flat_rate: number | null;
  quantity: number;
  deposit: number;
  available: boolean;
  rules: string[];
  agreement_template: string;
  media: unknown;
  location: string;
  created_at: string;
  owner?: { display_name: string } | null;
};

export const LISTING_SELECT = "*, owner:profiles!listings_owner_id_fkey(display_name)";

export function toListing(row: ListingRow): Listing {
  return {
    id: row.id,
    ownerId: row.owner_id,
    ownerName: row.owner?.display_name || "Campus member",
    title: row.title,
    category: row.category as CategoryValue,
    condition: row.condition,
    description: row.description,
    tags: row.tags ?? [],
    hourlyRate: row.hourly_rate === null ? null : Number(row.hourly_rate),
    dailyRate: row.daily_rate === null ? null : Number(row.daily_rate),
    flatRate: row.flat_rate === null ? null : Number(row.flat_rate),
    quantity: row.quantity,
    deposit: Number(row.deposit),
    available: row.available,
    rules: row.rules ?? [],
    agreementTemplate: row.agreement_template,
    media: (Array.isArray(row.media) ? row.media : []) as Media[],
    location: row.location,
    createdAt: row.created_at,
  };
}

export function mainImage(listing: Pick<Listing, "media">) {
  return listing.media.find((m) => m.type === "image")?.url ?? "/placeholder.jpg";
}
