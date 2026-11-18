import { Link } from "@tanstack/react-router";
import { CATEGORIES } from "@/lib/config";
import { mainImage } from "@/lib/mappers";
import { priceLabel } from "@/lib/pricing";
import type { Listing } from "@/lib/types";
import { Icon } from "./icon";
import { SaveButton } from "./save-button";

/** Marketing-style card used on the home page. */
export function FeaturedListingCard({ listing }: { listing: Listing }) {
  const category = CATEGORIES.find((c) => c.value === listing.category);
  return (
    <Link
      to="/items/$id"
      params={{ id: listing.id }}
      className="group overflow-hidden rounded-2xl bg-card shadow-card transition hover:-translate-y-0.5 hover:shadow-lg"
    >
      <div className="relative aspect-[16/9] overflow-hidden">
        <img
          src={mainImage(listing)}
          alt={listing.title}
          loading="lazy"
          className="absolute inset-0 size-full object-cover transition duration-500 group-hover:scale-105"
        />
      </div>
      <div className="space-y-3 p-5 md:p-6">
        <h3 className="truncate font-heading text-lg font-medium">{listing.title}</h3>
        <p className="text-xl font-semibold text-rust">{priceLabel(listing)}</p>
        <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
          <span className="flex min-w-0 items-center gap-1">
            <Icon name="location_on" size={20} />
            <span className="truncate">{listing.location}</span>
          </span>
          <span className="shrink-0 rounded-full bg-honey-soft px-3 py-1 text-foreground">
            {category?.label.split(" ")[0]?.toLowerCase() ?? listing.category}
          </span>
        </div>
      </div>
    </Link>
  );
}

/** Compact card used in the browse grid, saved list, etc. */
export function ListingCard({ listing, saved }: { listing: Listing; saved?: boolean | undefined }) {
  const name = listing.ownerName;
  return (
    <article className="group relative overflow-hidden rounded-2xl bg-card shadow-card transition hover:shadow-lg">
      <Link to="/items/$id" params={{ id: listing.id }} className="block">
        <div className="relative aspect-square overflow-hidden">
          <img
            src={mainImage(listing)}
            alt={listing.title}
            loading="lazy"
            className="absolute inset-0 size-full object-cover transition duration-500 group-hover:scale-105"
          />
        </div>
        <div className="space-y-1.5 p-4">
          <h3 className="truncate font-heading text-base font-medium">{listing.title}</h3>
          <p>{priceLabel(listing)}</p>
          <p className="flex items-center gap-2 truncate text-sm text-muted-foreground">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-honey-soft text-xs font-bold text-foreground">
              {name.charAt(0)}
            </span>
            <span className="truncate">
              {name} · {listing.location}
            </span>
          </p>
        </div>
      </Link>
      {saved !== undefined && (
        <div className="absolute right-3 top-3">
          <SaveButton listingId={listing.id} initialSaved={saved} />
        </div>
      )}
    </article>
  );
}
