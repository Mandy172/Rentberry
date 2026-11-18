import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { EmptyState, PageTitle } from "@/components/page-title";
import { Button, buttonVariants } from "@/components/ui/button";
import { BRAND, formatMoney } from "@/lib/config";
import { myRentalsQueryOptions } from "@/lib/queries";
import { updateRental } from "@/lib/rentals.functions";
import type { Rental, RentalStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/my-rentals")({
  validateSearch: z.object({ tab: z.enum(["rentals", "requests"]).optional().catch(undefined) }),
  head: () => ({ meta: [{ title: `My rentals | ${BRAND.name}` }, { name: "description", content: "Your rentals and incoming requests." }, { property: "og:title", content: `My rentals | ${BRAND.name}` }, { property: "og:description", content: "Your rentals and incoming requests." }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(myRentalsQueryOptions),
  component: MyRentalsPage,
  errorComponent: ({ error }) => <p className="p-8 text-center text-destructive">{error instanceof Error ? error.message : String(error)}</p>,
});

const STATUS_STYLE: Record<RentalStatus, string> = {
  pending: "bg-honey-soft",
  accepted: "bg-success/15 text-success",
  declined: "bg-muted text-muted-foreground",
  cancelled: "bg-muted text-muted-foreground",
  completed: "bg-ink text-honey",
};

function MyRentalsPage() {
  const { tab = "rentals" } = Route.useSearch();
  const navigate = useNavigate({ from: "/my-rentals" });
  const { data } = useSuspenseQuery(myRentalsQueryOptions);
  const queryClient = useQueryClient();
  const list = tab === "requests" ? data.requests : data.borrowing;
  const pendingRequests = data.requests.filter((r) => r.status === "pending").length;

  async function act(id: string, action: "accept" | "decline" | "cancel" | "complete") {
    const res = await updateRental({ data: { id, action } });
    if (!res.ok) toast.error("That request changed. Refreshing.");
    queryClient.invalidateQueries({ queryKey: ["me", "rentals"] });
  }

  return (
    <section className="px-4 py-10 md:py-14">
      <div className="mx-auto max-w-4xl">
        <PageTitle title="My rentals" />
        <div role="tablist" className="mt-8 inline-flex rounded-xl bg-card p-1 shadow-sm">
          {(["rentals", "requests"] as const).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => navigate({ search: { tab: t } })}
              className={cn("rounded-lg px-5 py-2.5 font-semibold transition", tab === t ? "bg-honey" : "text-muted-foreground hover:text-foreground")}
            >
              {t === "rentals" ? "Things I'm renting" : `Requests for my items${pendingRequests ? ` (${pendingRequests})` : ""}`}
            </button>
          ))}
        </div>

        {list.length === 0 ? (
          tab === "rentals" ? (
            <EmptyState icon="real_estate_agent" title="No rentals yet" body="Find something you need and send a request.">
              <Link to="/browse" className={buttonVariants()}>Browse items</Link>
            </EmptyState>
          ) : (
            <EmptyState icon="inbox" title="No requests yet" body="When someone wants to rent your item, it shows up here." />
          )
        ) : (
          <ul className="mt-6 space-y-4">
            {list.map((r) => (
              <RentalRow key={r.id} rental={r} asOwner={tab === "requests"} onAct={act} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function RentalRow({ rental: r, asOwner, onAct }: { rental: Rental; asOwner: boolean; onAct: (id: string, a: "accept" | "decline" | "cancel" | "complete") => void }) {
  const fmt = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  return (
    <li className="rounded-2xl bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {r.listingId ? (
            <Link to="/items/$id" params={{ id: r.listingId }} className="font-heading text-lg font-medium hover:underline">{r.listingTitle}</Link>
          ) : (
            <p className="font-heading text-lg font-medium">{r.listingTitle}</p>
          )}
          <p className="text-sm text-muted-foreground">
            {fmt(r.startDate)} – {fmt(r.endDate)} · {r.days} day{r.days > 1 ? "s" : ""}{r.quantity > 1 ? ` · ×${r.quantity}` : ""} · {asOwner ? `from ${r.borrowerName}` : `with ${r.ownerName}`}
          </p>
        </div>
        <span className={cn("rounded-full px-3 py-1 text-xs font-semibold capitalize", STATUS_STYLE[r.status])}>{r.status}</span>
      </div>
      <p className="mt-3 text-sm">
        <strong>{formatMoney(r.subtotal)}</strong>
        {asOwner && <span className="text-muted-foreground"> · you receive {formatMoney(r.subtotal - r.fee)}</span>}
        <span className="text-muted-foreground"> · {formatMoney(r.deposit)} deposit</span>
      </p>
      {r.note && <p className="mt-2 rounded-xl bg-background p-3 text-sm text-muted-foreground">“{r.note}”</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        {asOwner && r.status === "pending" && (
          <>
            <Button size="sm" onClick={() => onAct(r.id, "accept")}>Accept</Button>
            <Button size="sm" variant="outline" onClick={() => onAct(r.id, "decline")}>Decline</Button>
          </>
        )}
        {asOwner && r.status === "accepted" && (
          <Button size="sm" variant="ink" onClick={() => onAct(r.id, "complete")}>Mark returned</Button>
        )}
        {!asOwner && r.status === "pending" && (
          <Button size="sm" variant="outline" onClick={() => onAct(r.id, "cancel")}>Cancel request</Button>
        )}
      </div>
    </li>
  );
}
