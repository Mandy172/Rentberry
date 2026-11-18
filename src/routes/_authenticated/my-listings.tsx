import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Icon } from "@/components/icon";
import { EmptyState, PageTitle } from "@/components/page-title";
import { Button, buttonVariants } from "@/components/ui/button";
import { BRAND } from "@/lib/config";
import { connectStripe, deleteListing, toggleListingAvailability } from "@/lib/listings.functions";
import { mainImage } from "@/lib/mappers";
import { priceLabel } from "@/lib/pricing";
import { meQueryOptions, myListingsQueryOptions } from "@/lib/queries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/my-listings")({
  head: () => ({ meta: [{ title: `My listings | ${BRAND.name}` }, { name: "description", content: "Manage the items you lend." }, { property: "og:title", content: `My listings | ${BRAND.name}` }, { property: "og:description", content: "Manage the items you lend." }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(myListingsQueryOptions),
  component: MyListingsPage,
  errorComponent: ({ error }) => <p className="p-8 text-center text-destructive">{error instanceof Error ? error.message : String(error)}</p>,
});

function MyListingsPage() {
  const { data: listings } = useSuspenseQuery(myListingsQueryOptions);
  const { data: me } = useSuspenseQuery(meQueryOptions);
  const queryClient = useQueryClient();
  const [connecting, setConnecting] = useState(false);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["me", "listings"] });

  async function onConnect() {
    setConnecting(true);
    const res = await connectStripe({ data: { returnPath: "/my-listings" } });
    setConnecting(false);
    if (!res.ok) { toast.error(res.error); return; }
    if (res.url) {
      window.location.href = res.url;
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["me"], exact: true });
    toast.success(res.mock ? "Payouts connected (demo mode)." : "Payouts connected.");
  }

  return (
    <section className="px-4 py-10 md:py-14">
      <div className="mx-auto max-w-5xl">
        <PageTitle
          title="My listings"
          subtitle="Pause, remove, or check on the things you lend."
          action={<Link to="/post-item" className={buttonVariants()}><Icon name="add" /> Post an item</Link>}
        />

        <div className={cn("mt-8 flex flex-wrap items-center gap-4 rounded-2xl p-5", me?.stripeConnected ? "bg-card shadow-sm" : "bg-honey-soft")}>
          <Icon name={me?.stripeConnected ? "check_circle" : "account_balance"} size={32} className={me?.stripeConnected ? "text-success" : ""} />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{me?.stripeConnected ? "Payouts are set up" : "Set up payouts with Stripe"}</p>
            <p className="text-sm text-muted-foreground">
              {me?.stripeConnected ? "Rental earnings go straight to your Stripe account." : "Connect a Stripe account so you can get paid when someone rents your item."}
            </p>
          </div>
          {!me?.stripeConnected && (
            <Button variant="ink" className="w-full sm:w-auto" onClick={onConnect} disabled={connecting}>{connecting ? "Opening Stripe…" : "Connect Stripe"}</Button>
          )}
        </div>

        {listings.length === 0 ? (
          <EmptyState icon="inventory_2" title="You haven't listed anything yet" body="Post an item in a few minutes and start earning.">
            <Link to="/post-item" className={buttonVariants()}>Post your first item</Link>
          </EmptyState>
        ) : (
          <ul className="mt-8 space-y-4">
            {listings.map((l) => (
              <li key={l.id} className="flex flex-col gap-4 rounded-2xl bg-card p-4 shadow-sm sm:flex-row sm:items-center">
                <Link to="/items/$id" params={{ id: l.id }} className="flex min-w-0 flex-1 items-center gap-4">
                  <img src={mainImage(l)} alt="" className="size-20 shrink-0 rounded-xl object-cover" />
                  <div className="min-w-0">
                    <p className="truncate font-heading text-lg font-medium">{l.title}</p>
                    <p className="text-sm text-muted-foreground">{priceLabel(l)} · {l.location}</p>
                    <span className={cn("mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold", l.available ? "bg-honey-soft" : "bg-muted text-muted-foreground")}>
                      {l.available ? "Available" : "Paused"}
                    </span>
                  </div>
                </Link>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      await toggleListingAvailability({ data: { id: l.id } });
                      refresh();
                    }}
                  >
                    <Icon name={l.available ? "pause" : "play_arrow"} size={18} /> {l.available ? "Pause" : "Resume"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      if (!confirm(`Remove "${l.title}"? This can't be undone.`)) return;
                      await deleteListing({ data: { id: l.id } });
                      toast.success("Listing removed.");
                      refresh();
                    }}
                  >
                    <Icon name="delete" size={18} /> Remove
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
