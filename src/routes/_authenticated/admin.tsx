import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Field, Input, Select, Textarea } from "@/components/form-field";
import { Icon } from "@/components/icon";
import { EmptyState, PageTitle } from "@/components/page-title";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  adminCancelRental,
  adminDeleteListing,
  adminGetOverview,
  adminListListings,
  adminListMembers,
  adminListRentals,
  adminListingEditSchema,
  adminSetSuspended,
  adminUnlock,
  adminUpdateListing,
  type AdminListingEdit,
} from "@/lib/admin.functions";
import { BRAND, CAMPUS_LOCATIONS, CATEGORIES, CONDITIONS, formatMoney } from "@/lib/config";
import { mainImage } from "@/lib/mappers";
import { priceLabel } from "@/lib/pricing";
import { meQueryOptions } from "@/lib/queries";
import type { Listing, RentalStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { firstError } from "@/lib/validation";

const TABS = [
  { value: "overview", label: "Overview", icon: "monitoring" },
  { value: "listings", label: "Listings", icon: "inventory_2" },
  { value: "members", label: "Members", icon: "group" },
  { value: "rentals", label: "Rentals", icon: "real_estate_agent" },
] as const;
type Tab = (typeof TABS)[number]["value"];

export const Route = createFileRoute("/_authenticated/admin")({
  validateSearch: z.object({ tab: z.enum(["overview", "listings", "members", "rentals"]).optional().catch(undefined) }),
  head: () => ({
    meta: [
      { title: `Admin | ${BRAND.name}` },
      { name: "description", content: `Manage ${BRAND.name} listings, members and rentals.` },
      { property: "og:title", content: `Admin | ${BRAND.name}` },
      { property: "og:description", content: `Manage ${BRAND.name} listings, members and rentals.` },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(meQueryOptions),
  component: AdminPage,
});

const PASS_KEY = "rentberry-admin-pass";

function useAdminPass() {
  const [pass, setPass] = useState<string | null>(null);
  useEffect(() => setPass(sessionStorage.getItem(PASS_KEY)), []);
  return {
    pass,
    save: (p: string) => {
      sessionStorage.setItem(PASS_KEY, p);
      setPass(p);
    },
    clear: () => {
      sessionStorage.removeItem(PASS_KEY);
      setPass(null);
    },
  };
}

/** Unwraps an admin result; a wrong/missing password sends the admin back to the password screen. */
function unwrap<T extends { ok: boolean }>(res: T, onLocked: () => void): Extract<T, { ok: true }> {
  if (!res.ok) {
    const error = (res as unknown as { error: string }).error;
    if (/password/i.test(error)) onLocked();
    throw new Error(error);
  }
  return res as Extract<T, { ok: true }>;
}

function AdminPage() {
  const { data: me } = useSuspenseQuery(meQueryOptions);
  const { tab = "overview" } = Route.useSearch();
  const navigate = useNavigate({ from: "/admin" });
  const { pass, save, clear } = useAdminPass();

  if (!me?.isAdmin) {
    return (
      <section className="px-4 py-16">
        <EmptyState icon="lock" title="Admins only" body="This area is for the RentBerry team.">
          <Link to="/browse" className="font-semibold underline">Back to browsing</Link>
        </EmptyState>
      </section>
    );
  }

  return (
    <section className="px-4 py-10 md:py-14">
      <div className="mx-auto max-w-6xl">
        <PageTitle
          title="Admin"
          subtitle="Everything on RentBerry, in one place."
          action={pass ? <Button variant="ghost" size="sm" onClick={clear}><Icon name="lock" size={18} /> Lock</Button> : undefined}
        />
        {!pass ? (
          <PasswordGate onUnlock={save} />
        ) : (
          <>
            <div role="tablist" className="mt-8 flex gap-2 overflow-x-auto pb-1">
              {TABS.map((t) => (
                <button
                  key={t.value}
                  role="tab"
                  aria-selected={tab === t.value}
                  onClick={() => navigate({ search: { tab: t.value } })}
                  className={cn(
                    "flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 font-semibold transition",
                    tab === t.value ? "bg-ink text-honey" : "bg-card text-muted-foreground shadow-sm hover:text-foreground",
                  )}
                >
                  <Icon name={t.icon} size={20} /> {t.label}
                </button>
              ))}
            </div>
            <div className="mt-6">
              {tab === "overview" && <OverviewTab pass={pass} onLocked={clear} />}
              {tab === "listings" && <ListingsTab pass={pass} onLocked={clear} />}
              {tab === "members" && <MembersTab pass={pass} onLocked={clear} myId={me.id} />}
              {tab === "rentals" && <RentalsTab pass={pass} onLocked={clear} />}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function PasswordGate({ onUnlock }: { onUnlock: (p: string) => void }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await adminUnlock({ data: { passcode: value } });
    setBusy(false);
    if (!res.ok) { setError(res.error); return; }
    onUnlock(value);
  }
  return (
    <form onSubmit={submit} className="mx-auto mt-10 max-w-md space-y-5 rounded-2xl bg-card p-8 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="flex size-12 items-center justify-center rounded-full bg-honey-soft"><Icon name="admin_panel_settings" /></span>
        <div>
          <p className="font-semibold">Enter the admin password</p>
          <p className="text-sm text-muted-foreground">Asked once per browser tab.</p>
        </div>
      </div>
      <Field label="Admin password" htmlFor="admin-pass" error={error ?? undefined}>
        <Input id="admin-pass" type="password" autoComplete="current-password" value={value} onChange={(e) => setValue(e.target.value)} />
      </Field>
      <Button type="submit" className="w-full" disabled={busy || !value}>{busy ? "Checking…" : "Unlock admin"}</Button>
    </form>
  );
}

type TabProps = { pass: string; onLocked: () => void };

function Loading() {
  return <p className="p-10 text-center text-muted-foreground">Loading…</p>;
}
function Failed({ error }: { error: unknown }) {
  return <p className="rounded-2xl bg-card p-8 text-center text-destructive shadow-sm">{error instanceof Error ? error.message : "Something went wrong."}</p>;
}

function Stat({ label, value, icon }: { label: string; value: string | number; icon: string }) {
  return (
    <div className="rounded-2xl bg-card p-5 shadow-sm">
      <Icon name={icon} className="text-muted-foreground" />
      <p className="mt-3 font-heading text-3xl font-semibold">{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

function OverviewTab({ pass, onLocked }: TabProps) {
  const q = useQuery({ queryKey: ["admin", "overview"], queryFn: async () => unwrap(await adminGetOverview({ data: { passcode: pass } }), onLocked).overview, retry: false });
  if (q.isPending) return <Loading />;
  if (q.isError) return <Failed error={q.error} />;
  const o = q.data;
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Stat icon="group" label={`Members (${o.verifiedMembers} verified)`} value={o.members} />
      <Stat icon="inventory_2" label={`Live listings (${o.pausedListings} hidden)`} value={o.liveListings} />
      <Stat icon="pending_actions" label="Rentals waiting for owner" value={o.rentalsByStatus.pending} />
      <Stat icon="payments" label="Fees from accepted rentals" value={formatMoney(o.feesEarned)} />
      <Stat icon="handshake" label="Accepted rentals" value={o.rentalsByStatus.accepted} />
      <Stat icon="task_alt" label="Completed rentals" value={o.rentalsByStatus.completed} />
      <Stat icon="block" label="Suspended members" value={o.suspendedMembers} />
      <Stat icon="cancel" label="Cancelled or declined" value={o.rentalsByStatus.cancelled + o.rentalsByStatus.declined} />
    </div>
  );
}

function ListingsTab({ pass, onLocked }: TabProps) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Listing | null>(null);
  const q = useQuery({ queryKey: ["admin", "listings"], queryFn: async () => unwrap(await adminListListings({ data: { passcode: pass } }), onLocked).listings, retry: false });
  // Patch the cached list right away so the next edit starts from what's on screen.
  const patch = (id: string, changes: Partial<Listing> | null) =>
    queryClient.setQueryData<Listing[]>(["admin", "listings"], (list) =>
      list && (changes === null ? list.filter((l) => l.id !== id) : list.map((l) => (l.id === id ? { ...l, ...changes } : l))),
    );
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["admin"] });
    queryClient.invalidateQueries({ queryKey: ["listings"] });
    queryClient.invalidateQueries({ queryKey: ["listing"] });
  };
  if (q.isPending) return <Loading />;
  if (q.isError) return <Failed error={q.error} />;
  const term = search.trim().toLowerCase();
  const list = q.data.filter((l) => !term || l.title.toLowerCase().includes(term) || l.ownerName.toLowerCase().includes(term));

  async function toggle(l: Listing) {
    const res = await adminUpdateListing({ data: { passcode: pass, id: l.id, changes: toEdit(l, { available: !l.available }) } });
    if (!res.ok) { toast.error(res.error); return; }
    toast.success(l.available ? "Listing hidden from browse." : "Listing is live again.");
    patch(l.id, { available: !l.available });
    refresh();
  }
  async function remove(l: Listing) {
    if (!confirm(`Delete "${l.title}" for good? This can't be undone.`)) return;
    const res = await adminDeleteListing({ data: { passcode: pass, id: l.id } });
    if (!res.ok) { toast.error(res.error); return; }
    toast.success("Listing deleted.");
    patch(l.id, null);
    refresh();
  }

  return (
    <>
      <Input placeholder="Search by title or owner" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search listings" />
      {list.length === 0 ? (
        <EmptyState icon="inventory_2" title="No listings found" body="Try a different search." />
      ) : (
        <ul className="mt-4 space-y-3">
          {list.map((l) => (
            <li key={l.id} className="flex flex-col gap-4 rounded-2xl bg-card p-4 shadow-sm md:flex-row md:items-center">
              <Link to="/items/$id" params={{ id: l.id }} className="flex min-w-0 flex-1 items-center gap-4">
                <img src={mainImage(l)} alt="" className="size-16 shrink-0 rounded-xl object-cover" />
                <div className="min-w-0">
                  <p className="truncate font-semibold">{l.title}</p>
                  <p className="truncate text-sm text-muted-foreground">{priceLabel(l)} · {l.ownerName} · {l.location}</p>
                  <span className={cn("mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold", l.available ? "bg-honey-soft" : "bg-muted text-muted-foreground")}>
                    {l.available ? "Live" : "Hidden"}
                  </span>
                </div>
              </Link>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditing(l)}><Icon name="edit" size={18} /> Edit</Button>
                <Button variant="outline" size="sm" onClick={() => toggle(l)}>
                  <Icon name={l.available ? "visibility_off" : "visibility"} size={18} /> {l.available ? "Hide" : "Show"}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => remove(l)}><Icon name="delete" size={18} /> Delete</Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <EditListingDialog
        listing={editing}
        onClose={() => setEditing(null)}
        onSave={async (changes) => {
          if (!editing) return null;
          const res = await adminUpdateListing({ data: { passcode: pass, id: editing.id, changes } });
          if (!res.ok) return res.error;
          toast.success("Listing saved.");
          patch(editing.id, { ...changes, category: changes.category as Listing["category"] });
          setEditing(null);
          refresh();
          return null;
        }}
      />
    </>
  );
}

function toEdit(l: Listing, patch: Partial<AdminListingEdit> = {}): AdminListingEdit {
  return {
    title: l.title,
    description: l.description,
    category: l.category,
    condition: l.condition,
    location: l.location,
    dailyRate: l.dailyRate,
    hourlyRate: l.hourlyRate,
    flatRate: l.flatRate,
    deposit: l.deposit,
    quantity: l.quantity,
    available: l.available,
    ...patch,
  };
}

const num = (v: string) => (v.trim() === "" ? null : Number(v));

function EditListingDialog({ listing, onClose, onSave }: { listing: Listing | null; onClose: () => void; onSave: (c: AdminListingEdit) => Promise<string | null> }) {
  const [form, setForm] = useState<AdminListingEdit | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setForm(listing ? toEdit(listing) : null);
    setErrors({});
  }, [listing]);
  const set = <K extends keyof AdminListingEdit>(k: K, v: AdminListingEdit[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    const parsed = adminListingEditSchema.safeParse(form);
    if (!parsed.success) { setErrors(firstError(parsed.error)); return; }
    setBusy(true);
    const error = await onSave(parsed.data);
    setBusy(false);
    if (error) toast.error(error);
  }

  return (
    <Dialog open={!!listing} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader><DialogTitle>Edit listing</DialogTitle></DialogHeader>
        {form && (
          <form onSubmit={submit} className="space-y-4">
            <Field label="Title" htmlFor="e-title" error={errors["title"]}>
              <Input id="e-title" value={form.title} onChange={(e) => set("title", e.target.value)} />
            </Field>
            <Field label="Description" htmlFor="e-desc" error={errors["description"]}>
              <Textarea id="e-desc" value={form.description} onChange={(e) => set("description", e.target.value)} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Category" htmlFor="e-cat">
                <Select id="e-cat" value={form.category} onChange={(e) => set("category", e.target.value)}>
                  {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </Select>
              </Field>
              <Field label="Condition" htmlFor="e-cond">
                <Select id="e-cond" value={form.condition} onChange={(e) => set("condition", e.target.value)}>
                  {CONDITIONS.map((c) => <option key={c}>{c}</option>)}
                </Select>
              </Field>
            </div>
            <Field label="Pickup spot" htmlFor="e-loc">
              <Select id="e-loc" value={form.location} onChange={(e) => set("location", e.target.value)}>
                {CAMPUS_LOCATIONS.map((c) => <option key={c}>{c}</option>)}
              </Select>
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="₹ per day" htmlFor="e-day" error={errors["dailyRate"]}>
                <Input id="e-day" type="number" min={0} value={form.dailyRate ?? ""} onChange={(e) => set("dailyRate", num(e.target.value))} />
              </Field>
              <Field label="₹ per hour" htmlFor="e-hour">
                <Input id="e-hour" type="number" min={0} value={form.hourlyRate ?? ""} onChange={(e) => set("hourlyRate", num(e.target.value))} />
              </Field>
              <Field label="₹ flat" htmlFor="e-flat">
                <Input id="e-flat" type="number" min={0} value={form.flatRate ?? ""} onChange={(e) => set("flatRate", num(e.target.value))} />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Deposit (₹)" htmlFor="e-dep" error={errors["deposit"]}>
                <Input id="e-dep" type="number" min={0} value={form.deposit} onChange={(e) => set("deposit", num(e.target.value) ?? 0)} />
              </Field>
              <Field label="How many" htmlFor="e-qty" error={errors["quantity"]}>
                <Input id="e-qty" type="number" min={1} value={form.quantity} onChange={(e) => set("quantity", num(e.target.value) ?? 1)} />
              </Field>
            </div>
            <label className="flex items-center gap-3 font-semibold">
              <input type="checkbox" className="size-5 accent-ink" checked={form.available} onChange={(e) => set("available", e.target.checked)} />
              Show on browse
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save changes"}</Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function MembersTab({ pass, onLocked, myId }: TabProps & { myId: string }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const q = useQuery({ queryKey: ["admin", "members"], queryFn: async () => unwrap(await adminListMembers({ data: { passcode: pass } }), onLocked).members, retry: false });
  if (q.isPending) return <Loading />;
  if (q.isError) return <Failed error={q.error} />;
  const term = search.trim().toLowerCase().replace(/\s/g, "");
  const list = q.data.filter((m) => !term || m.name.toLowerCase().includes(term) || m.phone.includes(term));

  async function setSuspended(id: string, name: string, suspended: boolean) {
    if (suspended && !confirm(`Suspend ${name}? They won't be able to sign in, and their listings will be hidden.`)) return;
    const res = await adminSetSuspended({ data: { passcode: pass, userId: id, suspended } });
    if (!res.ok) { toast.error(res.error); return; }
    toast.success(suspended ? `${name} is suspended.` : `${name} can use RentBerry again.`);
    queryClient.invalidateQueries({ queryKey: ["admin"] });
    queryClient.invalidateQueries({ queryKey: ["listings"] });
  }

  return (
    <>
      <Input placeholder="Search by name or phone" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search members" />
      {list.length === 0 ? (
        <EmptyState icon="group" title="No members found" body="Members appear here after they sign in with their phone." />
      ) : (
        <ul className="mt-4 space-y-3">
          {list.map((m) => (
            <li key={m.id} className="flex flex-col gap-3 rounded-2xl bg-card p-4 shadow-sm sm:flex-row sm:items-center">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-honey font-bold">{m.name.charAt(0).toUpperCase()}</span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-semibold">
                  {m.name}
                  {m.isAdmin && <span className="rounded-full bg-ink px-2 py-0.5 text-xs text-honey">Admin</span>}
                  {m.suspended && <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-xs text-destructive">Suspended</span>}
                  {!m.verified && <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">Not verified</span>}
                </p>
                <p className="text-sm text-muted-foreground">
                  {m.phone} · {m.listings} listing{m.listings === 1 ? "" : "s"} · joined {new Date(m.joinedAt).toLocaleDateString("en-IN")}
                </p>
              </div>
              {m.id !== myId && (
                m.suspended ? (
                  <Button variant="outline" size="sm" onClick={() => setSuspended(m.id, m.name, false)}><Icon name="lock_open" size={18} /> Unsuspend</Button>
                ) : (
                  <Button variant="ghost" size="sm" onClick={() => setSuspended(m.id, m.name, true)}><Icon name="block" size={18} /> Suspend</Button>
                )
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

const STATUS_STYLE: Record<RentalStatus, string> = {
  pending: "bg-honey-soft",
  accepted: "bg-success/15 text-success",
  declined: "bg-muted text-muted-foreground",
  cancelled: "bg-muted text-muted-foreground",
  completed: "bg-ink text-honey",
};

function RentalsTab({ pass, onLocked }: TabProps) {
  const queryClient = useQueryClient();
  const q = useQuery({ queryKey: ["admin", "rentals"], queryFn: async () => unwrap(await adminListRentals({ data: { passcode: pass } }), onLocked).rentals, retry: false });
  if (q.isPending) return <Loading />;
  if (q.isError) return <Failed error={q.error} />;
  if (q.data.length === 0) return <EmptyState icon="real_estate_agent" title="No rentals yet" body="Rental requests will show up here." />;

  async function cancel(id: string, title: string) {
    if (!confirm(`Cancel the rental for "${title}"? Both members will be notified.`)) return;
    const res = await adminCancelRental({ data: { passcode: pass, id } });
    if (!res.ok) { toast.error(res.error); return; }
    toast.success("Rental cancelled.");
    queryClient.invalidateQueries({ queryKey: ["admin"] });
  }

  return (
    <ul className="space-y-3">
      {q.data.map((r) => (
        <li key={r.id} className="flex flex-col gap-3 rounded-2xl bg-card p-4 shadow-sm sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-2 font-semibold">
              <span className="truncate">{r.listingTitle}</span>
              <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize", STATUS_STYLE[r.status])}>{r.status}</span>
            </p>
            <p className="text-sm text-muted-foreground">
              {r.borrowerName} renting from {r.ownerName} · {r.startDate} → {r.endDate} · {formatMoney(r.subtotal)} (fee {formatMoney(r.fee)})
            </p>
          </div>
          {(r.status === "pending" || r.status === "accepted") && (
            <Button variant="ghost" size="sm" onClick={() => cancel(r.id, r.listingTitle)}><Icon name="cancel" size={18} /> Cancel</Button>
          )}
        </li>
      ))}
    </ul>
  );
}
