import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Icon } from "@/components/icon";
import { SaveButton } from "@/components/save-button";
import { Button, buttonVariants } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/form-field";
import { AGREEMENT_TEMPLATES, BRAND, CATEGORIES, formatMoney, PLATFORM_FEE_LABEL } from "@/lib/config";
import { contactOwner } from "@/lib/messages.functions";
import { daysBetween, priceLabel, rentalQuote } from "@/lib/pricing";
import { listingQueryOptions, savedIdsQueryOptions } from "@/lib/queries";
import { requestRental } from "@/lib/rentals.functions";
import { useMe } from "@/lib/session";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/items/$id")({
  loader: async ({ context, params }) => {
    if (!/^[0-9a-f-]{36}$/i.test(params.id)) throw notFound();
    const listing = await context.queryClient.ensureQueryData(listingQueryOptions(params.id));
    if (!listing) throw notFound();
    return { title: listing.title, description: listing.description };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.title ?? "Item"} | ${BRAND.name}` },
      { name: "description", content: loaderData?.description.slice(0, 155) ?? "" },
      { property: "og:title", content: `${loaderData?.title ?? "Item"} | ${BRAND.name}` },
      { property: "og:description", content: loaderData?.description.slice(0, 155) ?? "" },
    ],
  }),
  component: ItemPage,
  notFoundComponent: () => (
    <div className="px-4 py-24 text-center">
      <h1 className="text-3xl font-semibold">Item not found</h1>
      <p className="mt-2 text-muted-foreground">It may have been removed or paused by its owner.</p>
      <Link to="/browse" className={buttonVariants({ className: "mt-6" })}>Browse items</Link>
    </div>
  ),
  errorComponent: ({ error }) => <p className="p-8 text-center text-destructive">{error instanceof Error ? error.message : String(error)}</p>,
});

const today = () => new Date().toISOString().slice(0, 10);

function ItemPage() {
  const { id } = Route.useParams();
  const { data: listing } = useSuspenseQuery(listingQueryOptions(id));
  const { me } = useMe();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const saved = useQuery({ ...savedIdsQueryOptions, enabled: !!me?.verified });
  const [active, setActive] = useState(0);
  const [startDate, setStartDate] = useState(today());
  const [endDate, setEndDate] = useState(today());
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!listing) return null;
  const category = CATEGORIES.find((c) => c.value === listing.category);
  const agreement = AGREEMENT_TEMPLATES.find((t) => t.value === listing.agreementTemplate);
  const isOwner = me?.id === listing.ownerId;
  const days = daysBetween(startDate, endDate);
  const quote = rentalQuote(listing, Math.max(days, 1), quantity);
  const media = listing.media.length ? listing.media : [{ url: "/placeholder.jpg", type: "image" as const }];
  const current = media[Math.min(active, media.length - 1)] ?? media[0]!;
  const signInSearch = { next: `/items/${listing.id}`, ...(me && !me.verified ? { step: "selfie" as const } : {}) };

  async function onRequest(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = await requestRental({ data: { listingId: listing!.id, startDate, endDate, quantity, note } });
    setBusy(false);
    if (!res.ok) { setError(res.error); return; }
    toast.success("Request sent. The owner will be notified.");
    queryClient.invalidateQueries({ queryKey: ["me", "rentals"] });
    navigate({ to: "/my-rentals" });
  }

  async function onContact() {
    const res = await contactOwner({ data: { listingId: listing!.id } });
    if (!res.ok) { toast.error(res.error); return; }
    queryClient.invalidateQueries({ queryKey: ["me", "conversations"] });
    navigate({ to: "/messages", search: res.conversationId ? { c: res.conversationId } : {} });
  }

  return (
    <section className="px-4 py-10 md:py-14">
      <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1.2fr_1fr] lg:gap-x-10">
        <div className="lg:col-start-1 lg:self-start">
          <div className="relative overflow-hidden rounded-3xl bg-card shadow-card">
            {current.type === "video" ? (
              <video src={current.url} controls className="aspect-[4/3] w-full bg-ink object-contain" />
            ) : (
              <img src={current.url} alt={listing.title} className="aspect-[4/3] w-full object-cover" />
            )}
            {me?.verified && !isOwner && saved.data && (
              <div className="absolute right-4 top-4">
                <SaveButton listingId={listing.id} initialSaved={saved.data.includes(listing.id)} />
              </div>
            )}
          </div>
          {media.length > 1 && (
            <div className="mt-3 flex gap-3 overflow-x-auto">
              {media.map((m, i) => (
                <button
                  key={m.url}
                  type="button"
                  onClick={() => setActive(i)}
                  aria-label={`Show ${m.type} ${i + 1}`}
                  className={cn("size-20 shrink-0 overflow-hidden rounded-xl border-2", i === active ? "border-honey" : "border-transparent")}
                >
                  {m.type === "video" ? (
                    <span className="flex size-full items-center justify-center bg-ink text-honey"><Icon name="play_circle" /></span>
                  ) : (
                    <img src={m.url} alt="" className="size-full object-cover" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="order-last space-y-6 rounded-2xl bg-card p-6 shadow-sm md:p-8 lg:order-none lg:col-start-1 lg:self-start">
            <div>
              <h2 className="text-xl font-semibold">About this item</h2>
              <p className="mt-3 whitespace-pre-line leading-relaxed text-muted-foreground">{listing.description}</p>
            </div>
            {listing.rules.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold">House rules</h2>
                <ul className="mt-3 space-y-2">
                  {listing.rules.map((r) => (
                    <li key={r} className="flex items-start gap-2 text-muted-foreground">
                      <Icon name="check_circle" size={20} className="mt-0.5 text-rust" /> {r}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {agreement && (
              <div className="rounded-xl bg-honey-soft p-4">
                <p className="flex items-center gap-2 font-semibold"><Icon name="signature" /> {agreement.label}</p>
                <p className="mt-1 text-sm">{agreement.summary}</p>
              </div>
            )}
        </div>

        <div className="space-y-6 lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <div>
            <p className="flex flex-wrap items-center gap-2 text-sm">
              <span className="rounded-full bg-honey-soft px-3 py-1">{category?.label ?? listing.category}</span>
              <span className="rounded-full bg-muted px-3 py-1">{listing.condition}</span>
              {listing.tags.map((t) => (
                <span key={t} className="rounded-full border px-3 py-1 text-muted-foreground">#{t}</span>
              ))}
            </p>
            <h1 className="mt-4 text-3xl font-semibold md:text-4xl">{listing.title}</h1>
            <p className="mt-3 text-2xl font-semibold text-rust">{priceLabel(listing)}</p>
            <div className="mt-4 space-y-1 text-muted-foreground">
              <p className="flex items-center gap-2"><Icon name="location_on" size={20} /> Pickup at {listing.location}</p>
              <p className="flex items-center gap-2"><Icon name="person" size={20} /> Lent by {listing.ownerName}</p>
              <p className="flex items-center gap-2"><Icon name="shield" size={20} /> {formatMoney(listing.deposit)} refundable deposit</p>
              {listing.quantity > 1 && <p className="flex items-center gap-2"><Icon name="inventory_2" size={20} /> {listing.quantity} available</p>}
            </div>
          </div>

          {isOwner ? (
            <div className="rounded-2xl bg-card p-6 shadow-card">
              <p className="font-semibold">This is your listing.</p>
              <Link to="/my-listings" className={buttonVariants({ variant: "outline", className: "mt-4" })}>Manage my listings</Link>
            </div>
          ) : me?.verified ? (
            <form onSubmit={onRequest} className="space-y-5 rounded-2xl bg-card p-6 shadow-card md:p-8">
              <h2 className="text-2xl font-semibold">Request to rent</h2>
              <div className="grid grid-cols-2 gap-3">
                <Field label="From" htmlFor="start">
                  <Input id="start" type="date" min={today()} value={startDate} onChange={(e) => { setStartDate(e.target.value); if (e.target.value > endDate) setEndDate(e.target.value); }} required />
                </Field>
                <Field label="To" htmlFor="end">
                  <Input id="end" type="date" min={startDate} value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
                </Field>
              </div>
              {listing.quantity > 1 && (
                <Field label="Quantity" htmlFor="qty">
                  <Input id="qty" type="number" min={1} max={listing.quantity} value={quantity} onChange={(e) => setQuantity(Math.max(1, Math.min(listing.quantity, Number(e.target.value) || 1)))} />
                </Field>
              )}
              <Field label="Note for the owner" htmlFor="note" hint="Optional: what it's for, when you'd pick it up.">
                <Textarea id="note" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
              </Field>
              <dl className="space-y-1 rounded-xl bg-background p-4 text-sm">
                <div className="flex justify-between"><dt>{days || 0} day{days === 1 ? "" : "s"} × {quantity}</dt><dd className="font-semibold">{formatMoney(quote.subtotal)}</dd></div>
                <div className="flex justify-between text-muted-foreground"><dt>Refundable deposit</dt><dd>{formatMoney(quote.deposit)}</dd></div>
                <div className="flex justify-between text-muted-foreground"><dt>{BRAND.name} fee ({PLATFORM_FEE_LABEL}, paid by owner)</dt><dd>{formatMoney(quote.fee)}</dd></div>
              </dl>
              {error && <p className="text-sm font-medium text-destructive" role="alert">{error}</p>}
              <Button type="submit" size="lg" className="w-full" disabled={busy || days < 1}>
                {busy ? "Sending…" : "Send request"}
              </Button>
              <Button type="button" variant="outline" className="w-full" onClick={onContact}>
                <Icon name="chat_bubble" /> Message {listing.ownerName}
              </Button>
            </form>
          ) : (
            <div className="rounded-2xl bg-card p-6 text-center shadow-card md:p-8">
              <Icon name="verified_user" size={40} />
              <p className="mt-3 text-lg font-semibold">Verify once to rent or message</p>
              <p className="mt-1 text-muted-foreground">Phone code plus a quick live selfie keeps {BRAND.name} to real classmates.</p>
              <Link to="/sign-in" search={signInSearch} className={buttonVariants({ size: "lg", className: "mt-6 w-full" })}>
                {me ? "Finish verification" : "Sign in to rent"}
              </Link>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
