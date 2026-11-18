import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { Icon } from "@/components/icon";
import { ListingCard } from "@/components/listing-card";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/form-field";
import { BRAND, CAMPUS_LOCATIONS, CATEGORIES } from "@/lib/config";
import { listingsQueryOptions, savedIdsQueryOptions } from "@/lib/queries";
import { useMe } from "@/lib/session";
import { cn } from "@/lib/utils";

const searchSchema = z.object({
  q: z.string().max(100).optional().catch(undefined),
  category: z.string().max(30).optional().catch(undefined),
  location: z.string().max(60).optional().catch(undefined),
  maxPrice: z.coerce.number().min(0).max(1_000_000).optional().catch(undefined),
});

export const Route = createFileRoute("/browse")({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ q: search.q, category: search.category, location: search.location, maxPrice: search.maxPrice }),
  loader: ({ context, deps }) => context.queryClient.ensureQueryData(listingsQueryOptions(deps)),
  head: () => ({
    meta: [
      { title: `Browse items | ${BRAND.name}` },
      { name: "description", content: `Tools, party gear, electronics and more from verified ${BRAND.communityShort} classmates.` },
      { property: "og:title", content: `Browse items | ${BRAND.name}` },
      { property: "og:description", content: "Rent what you need from verified classmates." },
    ],
  }),
  component: BrowsePage,
  errorComponent: ({ error }) => <p className="p-8 text-center text-destructive">{error instanceof Error ? error.message : String(error)}</p>,
});

function BrowsePage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/browse" });
  const { data: listings } = useSuspenseQuery(listingsQueryOptions(search));
  const { me } = useMe();
  const saved = useQuery({ ...savedIdsQueryOptions, enabled: !!me?.verified });
  const savedSet = new Set(saved.data ?? []);
  const [q, setQ] = useState(search.q ?? "");
  const [maxPrice, setMaxPrice] = useState(search.maxPrice ? String(search.maxPrice) : "");

  return (
    <section className="px-4 py-10 md:py-14">
      <div className="mx-auto max-w-7xl">
        <h1 className="text-4xl font-semibold md:text-5xl">Browse items</h1>
        <p className="mt-2 text-lg text-muted-foreground">What classmates around {BRAND.communityShort} are lending right now.</p>

        <form
          className="mt-8 grid gap-3 rounded-2xl bg-card p-4 shadow-card md:grid-cols-[1fr_220px_160px_auto]"
          onSubmit={(e) => {
            e.preventDefault();
            const price = Number(maxPrice);
            navigate({ search: (prev) => ({ ...prev, q: q.trim() || undefined, maxPrice: price > 0 ? price : undefined }) });
          }}
        >
          <label className="relative">
            <span className="sr-only">Search</span>
            <Icon name="search" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search drones, coolers, drafters…" className="pl-12" />
          </label>
          <label>
            <span className="sr-only">Pickup spot</span>
            <Select
              value={search.location ?? ""}
              onChange={(e) => navigate({ search: (prev) => ({ ...prev, location: e.target.value || undefined }) })}
            >
              <option value="">Anywhere on campus</option>
              {CAMPUS_LOCATIONS.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </Select>
          </label>
          <label>
            <span className="sr-only">Max price per day</span>
            <Input type="number" min={0} inputMode="numeric" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} placeholder="Max ₹/day" />
          </label>
          <Button type="submit" className="h-12">Search</Button>
        </form>

        <div className="mt-6 flex flex-wrap gap-2" role="group" aria-label="Category">
          <CategoryChip active={!search.category} label="All" onClick={() => navigate({ search: (prev) => ({ ...prev, category: undefined }) })} />
          {CATEGORIES.map((c) => (
            <CategoryChip
              key={c.value}
              active={search.category === c.value}
              label={c.label}
              icon={c.icon}
              onClick={() => navigate({ search: (prev) => ({ ...prev, category: c.value }) })}
            />
          ))}
        </div>

        {listings.length === 0 ? (
          <div className="mt-16 rounded-2xl bg-card p-12 text-center shadow-sm">
            <Icon name="search_off" size={48} className="text-muted-foreground" />
            <p className="mt-4 text-lg font-semibold">Nothing matches yet</p>
            <p className="mt-1 text-muted-foreground">Try a different search, or be the first to list it.</p>
          </div>
        ) : (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {listings.map((l) => (
              <ListingCard key={l.id} listing={l} saved={me?.verified && l.ownerId !== me.id ? savedSet.has(l.id) : undefined} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function CategoryChip({ active, label, icon, onClick }: { active: boolean; label: string; icon?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm transition",
        active ? "border-ink bg-ink font-semibold text-honey" : "bg-card text-muted-foreground hover:text-foreground",
      )}
    >
      {icon && <Icon name={icon} size={18} />}
      {label}
    </button>
  );
}
