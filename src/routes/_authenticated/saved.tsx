import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ListingCard } from "@/components/listing-card";
import { EmptyState, PageTitle } from "@/components/page-title";
import { buttonVariants } from "@/components/ui/button";
import { BRAND } from "@/lib/config";
import { savedListingsQueryOptions } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/saved")({
  head: () => ({ meta: [{ title: `Saved | ${BRAND.name}` }, { name: "description", content: "Items you've saved." }, { property: "og:title", content: `Saved | ${BRAND.name}` }, { property: "og:description", content: "Items you've saved." }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(savedListingsQueryOptions),
  component: SavedPage,
  errorComponent: ({ error }) => <p className="p-8 text-center text-destructive">{error instanceof Error ? error.message : String(error)}</p>,
});

function SavedPage() {
  const { data } = useSuspenseQuery(savedListingsQueryOptions);
  return (
    <section className="px-4 py-10 md:py-14">
      <div className="mx-auto max-w-7xl">
        <PageTitle title="Saved" subtitle="Things you've got your eye on." />
        {data.length === 0 ? (
          <EmptyState icon="favorite" title="Nothing saved yet" body="Tap the heart on any item to keep it here.">
            <Link to="/browse" className={buttonVariants()}>Browse items</Link>
          </EmptyState>
        ) : (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {data.map((l) => (
              <ListingCard key={l.id} listing={l} saved />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
