import { Link } from "@tanstack/react-router";
import { BRAND } from "@/lib/config";
import type { Listing } from "@/lib/types";
import { FeaturedListingCard } from "../listing-card";
import { SectionHeading } from "../section-heading";
import { buttonVariants } from "../ui/button";

export function FeaturedListings({ listings }: { listings: Listing[] }) {
  return (
    <section className="px-4 py-20 md:py-28">
      <div className="mx-auto max-w-7xl">
        <SectionHeading title="Browse What's Available" subtitle={`The latest items listed on ${BRAND.name}`} />
        <div className="mt-14 grid gap-8 md:grid-cols-3">
          {listings.map((l) => (
            <FeaturedListingCard key={l.id} listing={l} />
          ))}
        </div>
        <div className="mt-14 flex flex-col items-center gap-6">
          <Link to="/browse" className={buttonVariants({ variant: "card", size: "lg" })}>
            View All Items
          </Link>
          <p className="text-muted-foreground">
            {"Don't see what you need? "}
            <Link to="/post-item" className="font-semibold text-foreground underline underline-offset-4">
              Be the first to list it.
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}
